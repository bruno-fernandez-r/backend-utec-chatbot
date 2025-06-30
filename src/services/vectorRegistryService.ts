/**
 * Servicio: vectorRegistryService.ts
 * ----------------------------------
 * Registra todos los vectores (activos e inactivos) de cada documento para trazabilidad
 * y posibilidad de borrado físico desde consola.
 * Este registro NO interfiere con documentTracking.json.
 */

import { BlobServiceClient } from "@azure/storage-blob";
import * as dotenv from "dotenv";
import { Readable } from "stream";
import { ReadableStream } from "stream/web";
import { pinecone } from "../config/pinecone";

dotenv.config();

const AZURE_CONTAINER_NAME = process.env.AZURE_CONTAINER_CONTROL!;
const AZURE_BLOB_NAME = "vectorRegistry.json";
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING!;

type VectorRegistryEntry = {
  vectorIds: string[];
  filename: string;
};

type Registry = Record<string, VectorRegistryEntry>;

let cachedRegistry: Registry | null = null;

async function getBlobClient() {
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(AZURE_CONTAINER_NAME);
  const blobClient = containerClient.getBlockBlobClient(AZURE_BLOB_NAME);
  return blobClient;
}

async function streamToString(stream: NodeJS.ReadableStream | null): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stream) return resolve("");

    const chunks: Uint8Array[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
}

export async function loadVectorRegistry(): Promise<Registry> {
  if (cachedRegistry !== null) return cachedRegistry;

  try {
    const blobClient = await getBlobClient();
    const downloadResponse = await blobClient.download();
    const stream = downloadResponse.readableStreamBody as NodeJS.ReadableStream | null;
    const content = await streamToString(stream);
    const parsed: Registry = JSON.parse(content);
    cachedRegistry = parsed;
    return parsed;
  } catch (error) {
    console.warn("⚠️ No se pudo cargar vectorRegistry.json. Se creará uno nuevo.");
    cachedRegistry = {};
    return cachedRegistry;
  }
}

export async function saveVectorRegistry(registry: Registry): Promise<void> {
  const blobClient = await getBlobClient();
  const data = JSON.stringify(registry, null, 2);
  await blobClient.upload(data, Buffer.byteLength(data), {
    blobHTTPHeaders: { blobContentType: "application/json" }
  });
  cachedRegistry = registry;
}

/**
 * Registra los vectores reales activos en Pinecone para un documento.
 * Ignora la lista que se pasa por parámetro y usa la que existe en Pinecone.
 */
export async function registerVectorIds(documentId: string, _vectorIds: string[], filename: string): Promise<void> {
  const registry = await loadVectorRegistry();

  const index = pinecone.index(process.env.PINECONE_INDEX!);
  const result = await index.query({
    vector: Array(1536).fill(0),
    topK: 1000,
    includeMetadata: true,
    includeValues: false,
    filter: { documentId, is_active: true }
  });

  const activeVectorIds = result.matches?.map((m) => m.id) || [];

  registry[documentId] = {
    vectorIds: activeVectorIds,
    filename
  };

  await saveVectorRegistry(registry);
}

export async function getVectorIdsByDocument(documentId: string): Promise<string[] | null> {
  const registry = await loadVectorRegistry();
  return registry[documentId]?.vectorIds || null;
}

export async function getFilenameByDocumentId(documentId: string): Promise<string | null> {
  const registry = await loadVectorRegistry();
  return registry[documentId]?.filename || null;
}
