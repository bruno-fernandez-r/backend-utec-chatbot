/**
 * Servicio: retrainFromTracking.ts
 * ---------------------------------
 * Expone una función que permite reentrenar un documento a partir de la entrada
 * existente en el archivo documentTracking.json para un bot determinado.
 */

import { trainGoogleDocForBot } from "./googleTrainingService";
import { getFileMetadata } from "./googleDriveService";

export interface DocumentTrackingRecord {
  documentId: string;
  filename: string;
  name?: string;
  mimeType?: string;
  usedByBots: string[];
  trainedAt: string;
}

const SUPPORTED_MIMETYPES = [
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
];

/**
 * Reentrena un documento si fue modificado desde su último entrenamiento.
 * Solo se aplica si el tipo MIME está soportado.
 */
export async function retrainDocumentIfNeeded(
  record: DocumentTrackingRecord,
  chatbotId: string
): Promise<void> {
  const mime = record.mimeType;

  if (!mime || !SUPPORTED_MIMETYPES.includes(mime)) {
    console.warn(`⚠️ MimeType '${mime}' no soportado para reentrenamiento automático.`);
    return;
  }

  try {
    const metadata = await getFileMetadata(record.documentId);
    const modifiedTime = new Date(metadata.modifiedTime);
    const trainedAt = new Date(record.trainedAt);

    if (trainedAt >= modifiedTime) {
      console.log(`✅ '${record.filename}' ya entrenado con versión actual.`);
      return;
    }

    console.log(`🔁 Reentrenando '${record.filename}' (está desactualizado)...`);

    const doc = {
      documentId: record.documentId,
      name: record.filename,
      mimeType: mime,
      modifiedTime: metadata.modifiedTime,
    };

    await trainGoogleDocForBot(doc, chatbotId);
  } catch (error) {
    console.error(`❌ Error al procesar '${record.filename}':`, error);
  }
}
