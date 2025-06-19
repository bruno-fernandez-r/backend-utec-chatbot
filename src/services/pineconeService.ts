// Servicio: pineconeService.ts
// -----------------------------
// Gestiona el almacenamiento, consulta y eliminación de vectores en Pinecone.
// Esta versión está adaptada para cuentas estándar (no serverless).
// Usa filtros por metadata (por documentId) para eliminar fragmentos.

import { generateEmbeddings } from "./openaiService";
import { pinecone } from "../config/pinecone";
import { encode } from "gpt-3-encoder";
import * as dotenv from "dotenv";
import { Message } from "./conversationMemory";
import { getTrackingState } from "./documentTrackingService";

dotenv.config();

const SCORE_THRESHOLD = 0.3;
const SCORE_FALLBACK = 0.4;
const TOP_K = 10;
const MAX_TOKENS_PER_FRAGMENT = 250;

/**
 * Guarda vectores en Pinecone para un documento.
 */
export async function saveVectorData(input: {
  id: string;
  content: string;
  metadata: {
    filename: string;
    name?: string;
    mimeType?: string;
    source: "azure" | "gdrive";
    fragmentIndex: number;
    documentId: string;
    [key: string]: any;
  };
}) {
  try {
    const { id: documentId, content, metadata } = input;
    const index = pinecone.index(process.env.PINECONE_INDEX!);

    const paragraphs = content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const fragments: { title: string; text: string }[] = [];
    let currentFragment = "";

    for (const paragraph of paragraphs) {
      const currentTokens = encode(currentFragment).length;
      const paraTokens = encode(paragraph).length;

      if (currentTokens + paraTokens <= MAX_TOKENS_PER_FRAGMENT) {
        currentFragment += paragraph + "\n\n";
      } else {
        if (currentFragment) fragments.push({ title: "Fragmento", text: currentFragment.trim() });
        currentFragment = paragraph + "\n\n";
      }
    }

    if (currentFragment) {
      fragments.push({ title: "Fragmento", text: currentFragment.trim() });
    }

    console.log(`📄 Documento segmentado en ${fragments.length} bloques.`);

    const vectors = await Promise.all(
      fragments.map(async (frag, i) => {
        const vectorId = `${sanitizeId(documentId)}_part${i}`;
        const embedding = await generateEmbeddings(frag.text);

        return {
          id: vectorId,
          values: embedding,
          metadata: {
            ...metadata,
            content: frag.text,
            title: frag.title,
          },
        };
      })
    );

    await index.upsert(vectors);
    console.log("🚀 Datos guardados en Pinecone exitosamente.");
  } catch (error) {
    console.error("❌ Error guardando en Pinecone:", error);
    throw new Error("Error guardando datos en Pinecone");
  }
}

/**
 * Verifica si hay vectores en Pinecone para un documento.
 */
export async function documentExistsInPinecone(documentId: string): Promise<boolean> {
  try {
    const matches = await queryByMetadata({ documentId }, 1); // ✅ sin $eq
    return matches.length > 0;
  } catch (error) {
    console.error("❌ Error verificando en Pinecone:", error);
    return false;
  }
}

/**
 * Consulta genérica por metadata (lectura).
 */
export async function queryByMetadata(filter: Record<string, any>, topK = 1000) {
  const index = pinecone.index(process.env.PINECONE_INDEX!);
  const results = await index.query({
    vector: Array(1536).fill(0),
    topK,
    includeMetadata: true,
    includeValues: false,
    filter,
  });
  return results.matches || [];
}

/**
 * Elimina todos los vectores asociados a un documento por su documentId (usando filtro).
 */
export async function deleteVectorsByDocumentId(documentId: string) {
  try {
    const index = pinecone.index(process.env.PINECONE_INDEX!);

    await index.deleteMany({
      filter: { documentId }, // ✅ sin $eq
    });

    console.log(`🧽 Vectores eliminados por filtro de documentId '${documentId}'`);
  } catch (error) {
    console.error("❌ Error eliminando vectores con filtro:", error);
    throw error;
  }
}

/**
 * Lista todos los fragmentos de un documento.
 */
export async function listVectorFragmentsByDocument(documentId: string) {
  return await queryByMetadata({ documentId }); // ✅ sin $eq
}

/**
 * Devuelve los documentos asociados a un bot.
 */
export async function listDocumentsByChatbot(chatbotId: string): Promise<string[]> {
  const tracking = await getTrackingState();
  return Object.entries(tracking)
    .filter(([_, value]) => value.usedByBots.includes(chatbotId))
    .map(([docId]) => docId);
}

/**
 * Devuelve los bots que usan un documento.
 */
export async function findChatbotsByDocumentId(documentId: string): Promise<string[]> {
  const tracking = await getTrackingState();
  return tracking[documentId]?.usedByBots || [];
}

/**
 * Consulta de datos relevantes por embedding.
 */
export async function searchVectorData(query: string, chatbotId: string, _history: Message[] = []): Promise<string> {
  try {
    const tracking = await getTrackingState();
    const documentos = Object.entries(tracking)
      .filter(([_, val]) => val.usedByBots.includes(chatbotId))
      .map(([docId]) => docId);

    if (documentos.length === 0) {
      console.warn(`⚠️ El bot '${chatbotId}' no tiene documentos asignados en usedByBots[].`);
      return "⚠️ No hay documentos disponibles para este bot.";
    }

    const index = pinecone.index(process.env.PINECONE_INDEX!);
    const embedding = await generateEmbeddings(query);

    const results = await index.query({
      vector: embedding,
      topK: TOP_K,
      includeMetadata: true,
      filter: {
        documentId: { $in: documentos }, // ✅ esto sí está permitido
      },
    });

    let relevantMatches = results.matches?.filter(m => m.score && m.score >= SCORE_THRESHOLD) || [];
    if (relevantMatches.length < 5) {
      relevantMatches = results.matches?.filter(m => m.score && m.score >= SCORE_FALLBACK) || [];
    }

    if (relevantMatches.length === 0) {
      return "⚠️ No se encontraron resultados relevantes.";
    }

    const groupedResults: Record<string, string[]> = {};
    relevantMatches.forEach(match => {
      const title = typeof match.metadata?.title === "string" ? match.metadata.title : "Información relevante";
      const content = typeof match.metadata?.content === "string" ? match.metadata.content : "";
      const source = match.metadata?.filename || "desconocido";

      if (!groupedResults[title]) {
        groupedResults[title] = [];
      }

      groupedResults[title].push(`${content}\n(Fuente: ${source})`);
    });

    return Object.entries(groupedResults)
      .map(([title, contents]) => `🔹 *${title}*\n${contents.join("\n\n")}`)
      .join("\n\n");
  } catch (error) {
    console.error("❌ Error buscando en Pinecone:", error);
    throw new Error("Error buscando datos en Pinecone");
  }
}

function sanitizeId(id: string): string {
  return id.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x00-\x7F]/g, "");
}
