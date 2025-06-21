import { Request, Response } from "express";
import {
  getTrackingState,
  saveTrackingState,
  cleanupUnusedDocument,
  invalidateTrackingCache,
} from "../services/documentTrackingService";
import {
  documentExistsInPinecone,
  pinecone,
} from "../services/pineconeService";

/**
 * DELETE /train/:chatbotId/document/:documentId
 */
export const deleteBotFromDocument = async (req: Request, res: Response) => {
  const { chatbotId, documentId } = req.params;

  if (!chatbotId?.trim() || !documentId?.trim()) {
    return res.status(400).json({
      error: "Faltan parámetros requeridos: chatbotId y documentId.",
    });
  }

  try {
    console.log(`🧽 Desvinculando bot '${chatbotId}' del documento '${documentId}'...`);

    const tracking = await getTrackingState();
    const entry = tracking[documentId];

    if (!entry) {
      return res.status(404).json({ error: `No se encontró '${documentId}' en el tracking.` });
    }

    const wasLinked = entry.usedByBots.includes(chatbotId);
    if (!wasLinked) {
      return res.status(200).json({
        success: false,
        message: `El bot '${chatbotId}' no estaba asociado al documento '${documentId}'. No se realizaron cambios.`,
      });
    }

    entry.usedByBots = entry.usedByBots.filter(botId => botId !== chatbotId);
    tracking[documentId] = entry;

    await saveTrackingState(tracking);
    console.log(`📘 Bot '${chatbotId}' eliminado del tracking del documento '${documentId}'.`);

    if (entry.usedByBots.length === 0) {
      console.log(`🧹 Documento '${documentId}' ya no es usado por ningún bot. Eliminando del tracking...`);
      await cleanupUnusedDocument(documentId);
    }

    return res.status(200).json({
      success: true,
      message: `El bot '${chatbotId}' olvidó el documento '${documentId}' correctamente.`,
    });
  } catch (error) {
    console.error("❌ Error al desvincular el documento:", error);
    return res.status(500).json({
      error: "Error interno al eliminar el vínculo entre el bot y el documento.",
    });
  }
};

/**
 * DELETE /train/:chatbotId/vectors
 * Elimina todo el rastro de un bot: lo borra de todos los documentos.
 * Si un documento queda sin bots, se eliminan sus vectores y su entrada en el tracking.
 */
export const deleteAllVectorsForBot = async (req: Request, res: Response) => {
  const { chatbotId } = req.params;

  if (!chatbotId?.trim()) {
    return res.status(400).json({ error: "Falta el parámetro chatbotId." });
  }

  try {
    console.log(`🧹 Eliminando todos los vectores asociados al bot '${chatbotId}'...`);

    const tracking = await getTrackingState();
    let modified = false;
    let eliminados: string[] = [];
    let actualizados: string[] = [];

    for (const [documentId, record] of Object.entries(tracking)) {
      if (!record.usedByBots.includes(chatbotId)) continue;

      // eliminar el bot
      record.usedByBots = record.usedByBots.filter(id => id !== chatbotId);
      modified = true;

      if (record.usedByBots.length === 0) {
        eliminados.push(documentId);
        await cleanupUnusedDocument(documentId);
      } else {
        tracking[documentId] = record;
        actualizados.push(documentId);
      }
    }

    if (modified) {
      await saveTrackingState(tracking);
    }

    return res.status(200).json({
      success: true,
      removedFrom: [...eliminados, ...actualizados],
      documentsEliminated: eliminados,
      documentsUpdated: actualizados,
      message: `Bot '${chatbotId}' eliminado de ${eliminados.length + actualizados.length} documentos.`,
    });
  } catch (error) {
    console.error("❌ Error al eliminar vectores del bot:", error);
    return res.status(500).json({
      error: "Error interno al eliminar los vectores del bot.",
    });
  }
};

/**
 * DELETE /train/document/:documentId
 */
export const deleteDocumentFromAllBots = async (req: Request, res: Response) => {
  const { documentId } = req.params;

  if (!documentId?.trim()) {
    return res.status(400).json({ error: "Falta el parámetro documentId." });
  }

  try {
    console.log(`🧽 Eliminando completamente el documento '${documentId}' del sistema...`);

    const tracking = await getTrackingState();
    const entry = tracking[documentId];

    if (!entry) {
      return res.status(404).json({ error: `No se encontró el documento '${documentId}' en el tracking.` });
    }

    const index = pinecone.index(process.env.PINECONE_INDEX!);
    const result = await index.query({
      vector: Array(1536).fill(0),
      topK: 100,
      includeMetadata: true,
      includeValues: true,
      filter: { documentId },
    });

    type PineconeMatch = {
      id: string;
      values: number[];
      metadata: Record<string, any>;
    };

    const toDeactivate = (result.matches as PineconeMatch[])?.filter(
      (m) => m.metadata?.is_active
    ) || [];

    if (toDeactivate.length > 0) {
      const updates = toDeactivate.map((m) => ({
        id: m.id,
        values: m.values,
        metadata: {
          ...m.metadata,
          is_active: false,
        },
      }));

      await index.upsert(updates);
      console.log(`✅ ${updates.length} vectores de '${documentId}' marcados como inactivos.`);
    } else {
      console.log(`ℹ️ No se encontraron vectores activos para desactivar.`);
    }

    delete tracking[documentId];
    await saveTrackingState(tracking);
    console.log(`🗂️ Registro del documento '${documentId}' eliminado del tracking.`);

    return res.status(200).json({
      success: true,
      message: `Documento '${documentId}' eliminado y vectores desactivados.`,
    });
  } catch (error) {
    console.error("❌ Error al eliminar el documento:", error);
    return res.status(500).json({
      error: "Error interno al eliminar el documento.",
    });
  }
};

/**
 * DELETE /train/purge/all
 */
export const purgeAllTrainingData = async (_req: Request, res: Response) => {
  try {
    console.warn("⚠️ Eliminando todo el contenido del tracking y marcando vectores como inactivos...");

    const tracking = await getTrackingState();
    const documentos = Object.keys(tracking);

    for (const documentId of documentos) {
      console.log(`🧹 Eliminando '${documentId}' del tracking...`);
    }

    await saveTrackingState({});
    invalidateTrackingCache();

    return res.status(200).json({
      success: true,
      message: "Todos los documentos fueron eliminados del tracking.",
    });
  } catch (error) {
    console.error("❌ Error al purgar los datos de entrenamiento:", error);
    return res.status(500).json({ error: "Error interno eliminando el tracking." });
  }
};

/**
 * GET /train/:chatbotId/status/:documentId
 */
export const getDocumentStatus = async (req: Request, res: Response) => {
  const { chatbotId, documentId } = req.params;

  try {
    const tracking = await getTrackingState();
    const entry = tracking[documentId];

    if (!entry) return res.status(200).json({ status: "no entrenado" });

    const usado = entry.usedByBots.includes(chatbotId);
    if (!usado) return res.status(200).json({ status: "no entrenado" });

    const existe = await documentExistsInPinecone(documentId);
    if (!existe) return res.status(200).json({ status: "desactualizado" });

    return res.status(200).json({ status: "actualizado" });
  } catch (error) {
    console.error("❌ Error verificando estado del documento:", error);
    return res.status(500).json({ error: "Error interno verificando el estado." });
  }
};
