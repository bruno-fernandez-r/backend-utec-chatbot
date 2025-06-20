// Objetivo: Gestiona el estado de entrenamiento de documentos, asociando bots a documentos procesados en Pinecone

import { BlobServiceClient } from "@azure/storage-blob";

const CONTAINER_NAME = process.env.AZURE_CONTAINER_CONTROL!;
const BLOB_NAME = "documentTracking.json";

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING!
);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

export interface DocumentTrackingRecord {
  documentId: string;
  filename: string;
  name?: string;
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
 * No borra vectores directamente. Se espera que el limpiador de vectores (cleanInactiveVectors) lo haga.
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

  // ⚠️ No se eliminan vectores directamente, se espera a la limpieza programada
  console.log(`🧼 [cleanupUnusedDocument] Eliminando '${documentId}' del tracking. Los vectores serán limpiados por cleanInactiveVectors().`);

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
    name: existente?.name ?? filename,
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
      console.log(`🧹 Documento '${documentId}' quedó sin bots. Eliminando del tracking...`);
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
