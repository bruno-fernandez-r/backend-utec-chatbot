/**
 * Controlador: trainingAnalyticsController.ts
 * -------------------------------------------
 * Provee endpoints de análisis y visualización de vectores entrenados en Pinecone,
 * así como un resumen global del estado de entrenamiento.
 */

import { Request, Response } from "express";
import { listVectorFragmentsByDocument } from "../services/pineconeService";

/**
 * GET /train/:chatbotId/fragments?documentId=...
 * Devuelve todos los fragmentos/vector entries para un bot.
 * Opcionalmente se puede filtrar por `documentId`.
 */
export const getBotFragments = async (req: Request, res: Response) => {
  const { chatbotId } = req.params;
  const { documentId } = req.query;

  if (!chatbotId) {
    return res.status(400).json({ error: "chatbotId es requerido en la ruta." });
  }

  if (!documentId) {
    return res.status(400).json({ error: "documentId es requerido como query param." });
  }

  try {
    const fragments = await listVectorFragmentsByDocument(documentId as string);
    return res.status(200).json({ chatbotId, documentId, fragments });
  } catch (error) {
    console.error("❌ Error obteniendo fragmentos:", error);
    return res.status(500).json({ error: "Error al obtener los fragmentos del bot." });
  }
};
