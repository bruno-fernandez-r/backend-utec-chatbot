/**
 * Controlador: syncVectorsController.ts
 * -------------------------------------
 * Reconstruye vectorRegistry.json desde Pinecone.
 * Recorre todos los vectores existentes sin importar estado lógico.
 */

import { Request, Response } from "express";
import { pinecone } from "../config/pinecone";
import { saveVectorRegistry } from "../services/vectorRegistryService";

export async function syncVectorRegistry(req: Request, res: Response) {
  try {
    const index = pinecone.index(process.env.PINECONE_INDEX!);

    const result = await index.query({
      vector: Array(1536).fill(0),
      topK: 10000,
      includeMetadata: true,
      includeValues: false
    });

    const registry: Record<string, { vectorIds: string[]; filename: string }> = {};
    let total = 0;

    if (Array.isArray(result.matches)) {
      for (const match of result.matches) {
        const metadata = match.metadata || {};
        const documentId = typeof metadata.documentId === "string" ? metadata.documentId : null;
        const filename = typeof metadata.filename === "string" ? metadata.filename : "desconocido";
        const vectorId = match.id;

        if (!documentId) continue;

        if (!registry[documentId]) {
          registry[documentId] = {
            vectorIds: [],
            filename
          };
          total++;
        }

        registry[documentId].vectorIds.push(vectorId);
      }
    }

    await saveVectorRegistry(registry);

    res.status(200).json({
      message: "vectorRegistry.json reconstruido 100% desde Pinecone.",
      totalDocuments: total
    });
  } catch (err) {
    console.error("❌ Error en /vectors/sync-vectors:", err);
    res.status(500).json({ error: "Error reconstruyendo vectorRegistry.json desde Pinecone" });
  }
}
 
