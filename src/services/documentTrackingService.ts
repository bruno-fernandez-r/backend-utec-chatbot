/**
 * Servicio: documentTrackingService.ts
 * -------------------------------------
 * Gestiona el estado de entrenamiento de documentos, asociando bots a documentos
 * y controlando su estado en Azure Blob Storage y Pinecone.
 */

import { BlobServiceClient } from "@azure/storage-blob";
import { pinecone } from "../config/pinecone";

const CONTAINER_NAME = process.env.AZURE_CONTAINER_CONTROL!;
const BLOB_NAME = "documentTracking.json";

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING!
);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

export interface DocumentTrackingRecord {
  documentId: string;
  filename: string;
  mimeType?: string;
  usedByBots: string[];
  trainedAt: string;
}

export type TrackingState = Record<string, DocumentTrackingRecord>;

let trackingCache: TrackingState = {};
let isWriting = false;

export const getTrackingState = async (): Promise<TrackingState> => {
  console.log("📦 [getTrackingState] Accediendo al tracking...");

  if (Object.keys(trackingCache).length > 0) {
    console.log("📦 [getTrackingState] Cache detectada, se devuelve directamente.");
    return trackingCache;
  }

  const blobClient = containerClient.getBlobClient(BLOB_NAME);
  const exists = await blobClient.exists();

  if (!exists) {
    console.log("📦 [getTrackingState] El archivo documentTracking.json no existe en Azure.");
    trackingCache = {};
    return trackingCache;
  }

  const downloadResponse = await blobClient.download();
  const downloaded = await streamToString(downloadResponse.readableStreamBody!);
  const parsed = JSON.parse(downloaded);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    console.warn("⚠️ [getTrackingState] Archivo malformado. Se reinicia como objeto vacío.");
    trackingCache = {};
    return trackingCache;
  }

  trackingCache = parsed;
  console.log("📥 [getTrackingState] Tracking cargado con", Object.keys(trackingCache).length, "documentos.");
  return trackingCache;
};

export const saveTrackingState = async (state: TrackingState): Promise<void> => {
  if (isWriting) {
    console.warn("🚫 [saveTrackingState] Escritura bloqueada por operación concurrente.");
    return;
  }

  if (!state || typeof state !== "object" || Array.isArray(state)) {
    console.error("❌ [saveTrackingState] Estado inválido. Debe ser un objeto.");
    return;
  }

  isWriting = true;
  try {
    const blobClient = containerClient.getBlockBlobClient(BLOB_NAME);
    const jsonString = JSON.stringify(state, null, 2);

    console.log("🚀 [saveTrackingState] Subiendo documentTracking.json a Azure...");
    await blobClient.upload(jsonString, Buffer.byteLength(jsonString), {
      blobHTTPHeaders: { blobContentType: "application/json" },
    });

    trackingCache = state;
    console.log("✅ [saveTrackingState] Archivo actualizado correctamente.");
  } catch (error) {
    console.error("❌ [saveTrackingState] Error al guardar en Azure:", error);
  } finally {
    isWriting = false;
  }
};

export const invalidateTrackingCache = () => {
  trackingCache = {};
  console.log("♻️ [invalidateTrackingCache] Cache limpiada.");
};

const streamToString = async (readableStream: NodeJS.ReadableStream): Promise<string> => {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    readableStream.on("data", (data) => chunks.push(data.toString()));
    readableStream.on("end", () => resolve(chunks.join("")));
    readableStream.on("error", reject);
  });
};

/**
 * ✅ Elimina un documento del tracking si no tiene bots asociados.
 * Marca todos sus fragmentos en Pinecone como `is_active: false`.
 */
export const cleanupUnusedDocument = async (documentId: string): Promise<void> => {
  const state = await getTrackingState();
  const doc = state[documentId];

  if (!doc) {
    console.log(`⚠️ [cleanupUnusedDocument] No se encontró '${documentId}' en el tracking.`);
    return;
  }

  if (doc.usedByBots.length > 0) {
    console.log(`ℹ️ [cleanupUnusedDocument] El documento '${documentId}' aún lo usan:`, doc.usedByBots);
    return;
  }

  try {
    const index = pinecone.index(process.env.PINECONE_INDEX!);

    console.log(`🧹 [cleanupUnusedDocument] Desactivando vectores de '${documentId}'...`);

    const result = await index.query({
      vector: Array(1536).fill(0),
      topK: 100,
      includeMetadata: true,
      includeValues: true,
      filter: { documentId },
    });

    const toDeactivate = result.matches?.filter(m => m.metadata?.is_active) || [];

    if (toDeactivate.length > 0) {
      const updates = toDeactivate.map(m => ({
        id: m.id,
        values: m.values!,
        metadata: {
          ...m.metadata,
          is_active: false,
        },
      }));

      await index.upsert(updates);
      console.log(`✅ [cleanupUnusedDocument] ${updates.length} vectores marcados como inactivos.`);
    } else {
      console.log(`ℹ️ [cleanupUnusedDocument] No se encontraron vectores activos para desactivar.`);
    }
  } catch (error) {
    console.warn("❌ [cleanupUnusedDocument] Error al desactivar vectores en Pinecone:", error);
  }

  delete state[documentId];
  trackingCache = state;
  await saveTrackingState(state);
  console.log(`✅ [cleanupUnusedDocument] Documento '${documentId}' eliminado del tracking.`);
};

export const updateTrackingRecord = async (params: {
  documentId: string;
  filename: string;
  mimeType?: string;
  chatbotId: string;
}) => {
  const { documentId, filename, mimeType, chatbotId } = params;
  const state = await getTrackingState();
  const ahora = new Date().toISOString();

  const existente = state[documentId];
  const yaRegistrado = existente?.usedByBots.includes(chatbotId);

  state[documentId] = {
    documentId,
    filename,
    mimeType,
    trainedAt: ahora,
    usedByBots: yaRegistrado
      ? existente.usedByBots
      : [...(existente?.usedByBots || []), chatbotId],
  };

  trackingCache = state;

  console.log("📦 [updateTrackingRecord] Registro actualizado:", state[documentId]);
  await saveTrackingState(state);
};

export const removeChatbotFromTracking = async (chatbotId: string): Promise<void> => {
  const state = await getTrackingState();
  let modified = false;

  for (const [documentId, record] of Object.entries(state)) {
    if (!record.usedByBots.includes(chatbotId)) continue;

    record.usedByBots = record.usedByBots.filter(id => id !== chatbotId);
    modified = true;

    if (record.usedByBots.length === 0) {
      console.log(`🧹 Documento '${documentId}' quedó sin bots. Eliminando...`);
      await cleanupUnusedDocument(documentId);
    } else {
      state[documentId] = record;
    }
  }

  if (modified) {
    await saveTrackingState(state);
    console.log(`✅ [removeChatbotFromTracking] Bot '${chatbotId}' eliminado del tracking.`);
  } else {
    console.log(`ℹ️ [removeChatbotFromTracking] El bot '${chatbotId}' no estaba registrado en ningún documento.`);
  }
};
