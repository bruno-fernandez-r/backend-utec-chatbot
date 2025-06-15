/**
 * Controlador: trainManagementController.ts
 * -----------------------------------------
 * Este controlador elimina el vínculo entre un chatbot y un documento.
 * Además elimina los vectores del documento para ese bot, y si el documento
 * queda sin uso por ningún bot, lo elimina completamente del tracking y de Pinecone.
 */

import { Request, Response } from "express";
import {
  getTrackingState,
  saveTrackingState,
  cleanupUnusedDocument,
} from "../services/documentTrackingService";
import {
  deleteVectorsManualmente,
} from "../services/pineconeService";

/**
 * DELETE /train/:chatbotId/document/:documentId
 * Elimina los vectores del bot para un documento y actualiza el tracking.
 */
export const deleteBotFromDocument = async (req: Request, res: Response) => {
  const { chatbotId, documentId } = req.params;

  if (!chatbotId?.trim() || !documentId?.trim()) {
    return res.status(400).json({
      error: "Faltan parámetros requeridos: chatbotId y documentId.",
    });
  }

  try {
    console.log(`🧽 Eliminando vectores del documento '${documentId}' para chatbot '${chatbotId}'...`);

    // 1. Eliminar vectores de Pinecone para ese bot
    await deleteVectorsManualmente(documentId, chatbotId);

    // 2. Obtener tracking y modificar
    const tracking = await getTrackingState();
    const entry = tracking[documentId];

    if (!entry) {
      return res.status(404).json({ error: `No se encontró '${documentId}' en el tracking.` });
    }

    // 3. Remover el bot del array
    entry.usedByBots = entry.usedByBots.filter(botId => botId !== chatbotId);
    tracking[documentId] = entry;

    // 4. Guardar cambios
    await saveTrackingState(tracking);
    console.log(`📘 Bot '${chatbotId}' eliminado del tracking del documento '${documentId}'.`);

    // 5. Si ya no lo usa ningún bot, eliminar totalmente
    if (entry.usedByBots.length === 0) {
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
