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
  deleteVectorsByDocumentId,
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

    entry.usedByBots = entry.usedByBots.filter(botId => botId !== chatbotId);
    tracking[documentId] = entry;

    await saveTrackingState(tracking);
    console.log(`📘 Bot '${chatbotId}' eliminado del tracking del documento '${documentId}'.`);

    // Si ya ningún bot lo usa, se limpia
    if (entry.usedByBots.length === 0) {
      console.log(`🧹 Documento '${documentId}' ya no es usado por ningún bot. Eliminando vectores y registro...`);
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
 * Elimina los vectores de todos los bots para un documento y actualiza el tracking.
 */
export const deleteDocumentFromAllBots = async (req: Request, res: Response) => {
  const { documentId } = req.params;

  if (!documentId?.trim()) {
    return res.status(400).json({ error: "Falta el parámetro documentId." });
  }

  try {
    console.log(`🧽 Eliminando todos los vectores del documento '${documentId}'...`);
    await deleteVectorsByDocumentId(documentId);

    const tracking = await getTrackingState();
    delete tracking[documentId];
    await saveTrackingState(tracking);

    return res.status(200).json({
      success: true,
      message: `Todos los vectores del documento '${documentId}' fueron eliminados correctamente.`,
    });
  } catch (error) {
    console.error("❌ Error al eliminar vectores del documento:", error);
    return res.status(500).json({
      error: "Error interno al eliminar vectores del documento.",
    });
  }
};

/**
 * DELETE /train/purge/all
 * Elimina absolutamente todos los vectores de todos los documentos y limpia el archivo tracking.
 */
export const purgeAllTrainingData = async (_req: Request, res: Response) => {
  try {
    console.warn("⚠️ Eliminando absolutamente todos los vectores de Pinecone...");

    const tracking = await getTrackingState();
    const documentos = Object.keys(tracking);

    for (const documentId of documentos) {
      await deleteVectorsByDocumentId(documentId);
    }

    await saveTrackingState({});
    invalidateTrackingCache();

    return res.status(200).json({
      success: true,
      message: "Todos los datos de entrenamiento fueron purgados correctamente.",
    });
  } catch (error) {
    console.error("❌ Error al purgar todos los vectores:", error);
    return res.status(500).json({ error: "Error interno eliminando todos los vectores." });
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
