import { BlobServiceClient } from "@azure/storage-blob";
import { deleteVectorsManualmente } from "./pineconeService";

const CONTAINER_NAME = process.env.AZURE_CONTAINER_CONTROL!;
const BLOB_NAME = "documentTracking.json";

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING!
);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

interface DocumentTrackingRecord {
  documentId: string;
  filename: string;
  mimeType?: string;
  usedByBots: string[];
  trainedAt: string;
}

type TrackingState = Record<string, DocumentTrackingRecord>;

let trackingCache: TrackingState = {};
let isWriting = false;

/**
 * Devuelve el estado actual del tracking desde Azure Blob Storage o desde caché.
 */
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

/**
 * Guarda el estado actualizado en Azure y en caché local.
 */
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

/**
 * Invalida la caché local, forzando la recarga desde Azure.
 */
export const invalidateTrackingCache = () => {
  trackingCache = {};
  console.log("♻️ [invalidateTrackingCache] Cache limpiada.");
};

/**
 * Convierte un stream a string.
 */
const streamToString = async (readableStream: NodeJS.ReadableStream): Promise<string> => {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    readableStream.on("data", (data) => chunks.push(data.toString()));
    readableStream.on("end", () => resolve(chunks.join("")));
    readableStream.on("error", reject);
  });
};

/**
 * Elimina un documento del tracking y sus vectores si ya no lo usa ningún bot.
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
    console.log(`🧹 [cleanupUnusedDocument] Eliminando vectores de '${documentId}'...`);
    await deleteVectorsManualmente(documentId, "*");
  } catch (error) {
    console.warn("❌ [cleanupUnusedDocument] Error al borrar vectores en Pinecone:", error);
  }

  delete state[documentId];
  trackingCache = state;
  await saveTrackingState(state);
  console.log(`✅ [cleanupUnusedDocument] Documento '${documentId}' eliminado del tracking.`);
};

/**
 * Agrega o actualiza un documento con el bot que lo entrenó.
 */
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

  console.log("📘 [updateTrackingRecord] Procesando:", {
    documentId,
    filename,
    chatbotId,
    mimeType,
  });

  if (existente) {
    const yaRegistrado = existente.usedByBots.includes(chatbotId);
    const nuevosBots = yaRegistrado ? existente.usedByBots : [...existente.usedByBots, chatbotId];

    state[documentId] = {
      ...existente,
      filename,
      mimeType,
      trainedAt: ahora,
      usedByBots: nuevosBots,
    };
  } else {
    state[documentId] = {
      documentId,
      filename,
      mimeType,
      trainedAt: ahora,
      usedByBots: [chatbotId],
    };
  }

  trackingCache = state;

  console.log("📦 [updateTrackingRecord] Estado actualizado:", state[documentId]);
  console.log("💾 [updateTrackingRecord] Estado final completo:", JSON.stringify(state, null, 2));

  await saveTrackingState(state);
};
