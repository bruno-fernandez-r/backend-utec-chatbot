/**
 * Controlador: trainManagementController.ts
 * -----------------------------------------
 * Administra la vinculación entre chatbots y documentos entrenados.
 * Permite olvidar documentos, eliminar vectores, sincronizar estado de entrenamiento
 * y obtener el estado de documentos específicos.
 */

import { Request, Response } from "express";
import {
  getTrackingState,
  saveTrackingState,
  cleanupUnusedDocument,
  invalidateTrackingCache,
} from "../services/documentTrackingService";
import {
  documentExistsInPinecone,
} from "../services/pineconeService";

/**
 * DELETE /train/:chatbotId/document/:documentId
 * Desvincula el documento del bot. Si ningún bot lo usa más, elimina vectores y tracking.
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

    // Si ya ningún bot lo usa, se limpia
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
 * DELETE /train/document/:documentId
 * Elimina el documento del tracking y marca sus vectores como inactivos.
 * La limpieza física de vectores será realizada por cleanInactiveVectors().
 */
export const deleteDocumentFromAllBots = async (req: Request, res: Response) => {
  const { documentId } = req.params;

  if (!documentId?.trim()) {
    return res.status(400).json({ error: "Falta el parámetro documentId." });
  }

  try {
    console.log(`🧽 Eliminando documento '${documentId}' del tracking...`);

    const tracking = await getTrackingState();
    delete tracking[documentId];
    await saveTrackingState(tracking);

    console.log(`🗂️ Documento '${documentId}' eliminado del tracking. Los vectores serán limpiados por cleanInactiveVectors().`);

    return res.status(200).json({
      success: true,
      message: `Documento '${documentId}' eliminado del tracking. Vectores marcados como inactivos.`,
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
 * Elimina todo el tracking y marca todos los vectores como inactivos.
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
      message: "Todos los documentos fueron eliminados del tracking. Los vectores serán limpiados por cleanInactiveVectors().",
    });
  } catch (error) {
    console.error("❌ Error al purgar los datos de entrenamiento:", error);
    return res.status(500).json({ error: "Error interno eliminando el tracking." });
  }
};

/**
 * GET /train/:chatbotId/status/:documentId
 * Verifica el estado del documento para un bot: actualizado, desactualizado o no entrenado.
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
