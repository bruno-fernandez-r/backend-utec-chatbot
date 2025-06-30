/**
 * Servicio: pineconeService.ts
 * -----------------------------
 * Gestiona el almacenamiento, consulta y eliminación de vectores en Pinecone.
 * Implementa estrategia de soft-delete con metadatos 'is_active' y 'last_trained_at_timestamp'.
 */

import { pinecone } from "../config/pinecone";
import { generateEmbeddings } from "./openaiService";
import { splitTextIntoFragments } from "./fragmentationService";
import { generateEmbeddingsForFragments } from "./embeddingService";
import { getTrackingState } from "./documentTrackingService";
// ❌ Eliminado: import { registerVectorIds } from "./vectorRegistryService";
import { Message } from "./conversationMemory";
import * as dotenv from "dotenv";

dotenv.config();

const SCORE_THRESHOLD = 0.3;
const SCORE_FALLBACK = 0.4;
const TOP_K = 10;
const BATCH_SIZE_UPSERT = 100;
const BATCH_SIZE_DELETE = 1000;

function sanitizeId(id: string): string {
  return id.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x00-\x7F]/g, "");
}

async function _updateDocumentInPineconeInternal(
  documentId: string,
  content: string,
  baseMetadata: {
    filename: string;
    mimeType?: string;
    source: "azure" | "gdrive";
    [key: string]: any;
  }
) {
  try {
    const index = pinecone.index(process.env.PINECONE_INDEX!);
    const timestamp = Date.now();

    const fragments = splitTextIntoFragments(content);
    console.log(`📄 Documento segmentado en ${fragments.length} fragmentos.`);

    const embeddings = await generateEmbeddingsForFragments(fragments);

    const newVectors = fragments.map((frag, i) => ({
      id: `${sanitizeId(documentId)}_part${i}`,
      values: embeddings[i],
      metadata: {
        ...baseMetadata,
        documentId,
        content: frag.text,
        title: frag.title,
        is_active: true,
        last_trained_at_timestamp: timestamp,
      },
    }));

    if (newVectors.length === 0) {
      console.warn(`⚠️ No se generaron fragmentos para el documento ${documentId}.`);
      return;
    }

    const previous = await index.query({
      vector: Array(1536).fill(0),
      topK: 100,
      includeMetadata: true,
      includeValues: true,
      filter: { documentId },
    });

    const fragmentsToDeactivate = previous.matches?.filter(match =>
      Number(match.metadata?.last_trained_at_timestamp || 0) < timestamp
    ) || [];

    if (fragmentsToDeactivate.length > 0) {
      console.log(`🔄 Desactivando ${fragmentsToDeactivate.length} fragmentos antiguos...`);
      const updates = fragmentsToDeactivate.map(match => ({
        id: match.id,
        values: match.values!,
        metadata: {
          ...match.metadata,
          is_active: false,
        },
      }));

      for (let i = 0; i < updates.length; i += BATCH_SIZE_UPSERT) {
        const batch = updates.slice(i, i + BATCH_SIZE_UPSERT);
        await index.upsert(batch);
      }
    }

    console.log(`✨ Insertando ${newVectors.length} nuevos fragmentos...`);
    await index.upsert(newVectors);

    // ❌ Ya no se registra vectorIds en vectorRegistry.json aquí

    console.log(`✅ Documento ${documentId} actualizado exitosamente.`);
  } catch (err) {
    console.error(`❌ Error actualizando documento ${documentId}:`, err);
    throw err;
  }
}

export async function saveVectorData(input: {
  id: string;
  content: string;
  metadata: {
    filename: string;
    mimeType?: string;
    source: "azure" | "gdrive";
    documentId: string;
    [key: string]: any;
  };
}) {
  await _updateDocumentInPineconeInternal(input.metadata.documentId, input.content, input.metadata);
}

export async function documentExistsInPinecone(documentId: string): Promise<boolean> {
  const matches = await queryByMetadata({ documentId }, 1);
  return matches.length > 0;
}

export async function queryByMetadata(filter: Record<string, any>, topK = 1000) {
  const index = pinecone.index(process.env.PINECONE_INDEX!);
  const combinedFilter = { ...filter, is_active: true };

  const results = await index.query({
    vector: Array(1536).fill(0),
    topK,
    includeMetadata: true,
    includeValues: false,
    filter: combinedFilter,
  });

  return results.matches || [];
}

export async function listVectorFragmentsByDocument(documentId: string) {
  return await queryByMetadata({ documentId });
}

export async function listDocumentsByChatbot(chatbotId: string): Promise<string[]> {
  const tracking = await getTrackingState();
  return Object.entries(tracking)
    .filter(([_, value]) => value.usedByBots.includes(chatbotId))
    .map(([docId]) => docId);
}

export async function findChatbotsByDocumentId(documentId: string): Promise<string[]> {
  const tracking = await getTrackingState();
  return tracking[documentId]?.usedByBots || [];
}

export async function cleanInactiveVectors() {
  try {
    const index = pinecone.index(process.env.PINECONE_INDEX!);
    console.log("🧹 Iniciando limpieza de vectores inactivos...");

    const inactive = await index.query({
      vector: Array(1536).fill(0),
      topK: 100000,
      includeMetadata: true,
      includeValues: false,
      filter: { is_active: false },
    });

    const idsToDelete = inactive.matches?.map(m => m.id) || [];

    if (idsToDelete.length > 0) {
      for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE_DELETE) {
        const batch = idsToDelete.slice(i, i + BATCH_SIZE_DELETE);
        await index.deleteMany(batch);
        console.log(`🗑️ Eliminado lote de ${batch.length} vectores.`);
      }
    } else {
      console.log("ℹ️ No se encontraron vectores inactivos.");
    }
  } catch (err) {
    console.error("❌ Error durante limpieza:", err);
    throw err;
  }
}

export async function searchVectorData(query: string, chatbotId: string, _history: Message[] = []): Promise<string> {
  try {
    const tracking = await getTrackingState();
    const documentos = Object.entries(tracking)
      .filter(([_, val]) => val.usedByBots.includes(chatbotId))
      .map(([docId]) => docId);

    if (documentos.length === 0) return "⚠️ No hay documentos disponibles para este bot.";

    const index = pinecone.index(process.env.PINECONE_INDEX!);
    const embedding = await generateEmbeddings(query);

    const results = await index.query({
      vector: embedding,
      topK: TOP_K,
      includeMetadata: true,
      filter: {
        documentId: { $in: documentos },
        is_active: true,
      },
    });

    let relevantMatches = results.matches?.filter(m => m.score && m.score >= SCORE_THRESHOLD) || [];
    if (relevantMatches.length < 5) {
      relevantMatches = results.matches?.filter(m => m.score && m.score >= SCORE_FALLBACK) || [];
    }

    if (relevantMatches.length === 0) return "⚠️ No se encontraron resultados relevantes.";

    const groupedResults: Record<string, string[]> = {};
    relevantMatches.forEach(match => {
      const title = typeof match.metadata?.title === "string" ? match.metadata.title : "Fragmento";
      const content = typeof match.metadata?.content === "string" ? match.metadata.content : "";
      const source = match.metadata?.filename || "desconocido";

      if (!groupedResults[title]) groupedResults[title] = [];
      groupedResults[title].push(`${content}\n(Fuente: ${source})`);
    });

    return Object.entries(groupedResults)
      .map(([title, contents]) => `🔹 *${title}*\n${contents.join("\n\n")}`)
      .join("\n\n");
  } catch (err) {
    console.error("❌ Error buscando en Pinecone:", err);
    throw new Error("Error buscando datos en Pinecone");
  }
}

export { pinecone };
