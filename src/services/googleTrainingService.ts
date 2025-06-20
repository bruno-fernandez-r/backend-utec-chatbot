/**
 * Servicio: googleTrainingService.ts
 * -----------------------------------
 * Este servicio entrena un documento de Google Drive de forma global.
 * Usa estrategia de soft delete (no elimina físicamente los vectores antiguos).
 * Actualiza el estado de entrenamiento en documentTracking.json y registra los bots asociados.
 */

import { parseGoogleDoc } from "./googleDocsParser";
import { parseGoogleSheet } from "./googleSheetsParser";
import { saveVectorData } from "./pineconeService";
import {
  getTrackingState,
  updateTrackingRecord,
} from "./documentTrackingService";

interface DriveDocument {
  documentId: string;
  filename: string; // Reemplaza el uso de "name"
  mimeType: string;
  modifiedTime: string;
}

/**
 * Entrena un documento de Google Drive (.gdoc o .gsheet) para un chatbot.
 * Evita reentrenamiento si ya está actualizado. Agrega el bot al tracking si es necesario.
 */
export async function trainGoogleDocForBot(
  doc: DriveDocument,
  chatbotId: string
): Promise<void> {
  const tracking = await getTrackingState();
  const existing = tracking[doc.documentId];
  const docModified = new Date(doc.modifiedTime);

  if (existing) {
    const lastTrained = new Date(existing.trainedAt);

    if (lastTrained >= docModified) {
      if (!existing.usedByBots.includes(chatbotId)) {
        await updateTrackingRecord({
          documentId: doc.documentId,
          filename: doc.filename,
          mimeType: doc.mimeType,
          chatbotId,
        });
        console.log(
          `✅ Documento ya entrenado. Se agregó el bot '${chatbotId}' a usedByBots.`
        );
      } else {
        console.log(
          "✅ Documento ya entrenado y bot ya registrado. No se requiere acción."
        );
      }
      return;
    }

    console.log(
      `🔁 Documento '${doc.documentId}' fue modificado. Reentrenando con nueva versión...`
    );
  }

  // 📥 Extraer contenido según tipo MIME
  let textoPlano: string;
  if (doc.mimeType === "application/vnd.google-apps.document") {
    textoPlano = await parseGoogleDoc(doc.documentId);
  } else if (doc.mimeType === "application/vnd.google-apps.spreadsheet") {
    textoPlano = await parseGoogleSheet(doc.documentId);
  } else {
    throw new Error(`Tipo MIME no soportado: ${doc.mimeType}`);
  }

  if (textoPlano.trim().length === 0) {
    console.warn(
      `⚠️ El documento '${doc.filename}' tiene contenido vacío. Se omite entrenamiento.`
    );
    return;
  }

  // 🧠 Guardar fragmentos vectorizados con metadatos
  await saveVectorData({
    id: doc.documentId,
    content: textoPlano,
    metadata: {
      filename: doc.filename,
      documentId: doc.documentId,
      mimeType: doc.mimeType,
      source: "gdrive",
    },
  });

  // 🕒 Registrar en documentTracking.json
  await updateTrackingRecord({
    documentId: doc.documentId,
    filename: doc.filename,
    mimeType: doc.mimeType,
    chatbotId,
  });

  console.log(`🚀 Documento '${doc.filename}' entrenado y registrado correctamente.`);
}
