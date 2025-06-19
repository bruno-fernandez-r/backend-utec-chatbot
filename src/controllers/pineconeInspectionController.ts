/**
 * Controlador: pineconeInspectionController.ts
 * --------------------------------------------
 * Consulta directa a Pinecone por documentId.
 * Devuelve cantidad de vectores y nombre del documento si existen.
 */

import { Request, Response } from "express";
import { queryByMetadata } from "../services/pineconeService";

/**
 * GET /pinecone/document/:documentId/count
 * Devuelve la cantidad de vectores en Pinecone para un documentId,
 * junto con el nombre del documento. Si no hay vectores, responde 404.
 */
export const getVectorCountForDocument = async (req: Request, res: Response) => {
  const { documentId } = req.params;

  if (!documentId) {
    return res.status(400).json({ error: "Falta el parámetro documentId." });
  }

  try {
    const matches = await queryByMetadata({ documentId: { $eq: documentId } }, 10);

    if (!matches || matches.length === 0) {
      return res.status(404).json({ error: "No se encontraron vectores para el documentId proporcionado." });
    }

    const filename = matches[0]?.metadata?.filename || null;

    return res.status(200).json({
      documentId,
      filename,
      vectorCount: matches.length
    });
  } catch (error) {
    console.error("❌ Error consultando vectores en Pinecone:", error);
    return res.status(500).json({ error: "Error interno al consultar Pinecone." });
  }
};
