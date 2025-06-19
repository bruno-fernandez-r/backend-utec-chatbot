/**
 * Servicio: googleTrainingService.ts
 * -----------------------------------
 * Este servicio entrena un documento de Google Drive de forma global.
 * Se guarda una sola vez en Pinecone y luego se reutiliza entre múltiples bots.
 */

import { parseGoogleDoc } from "./googleDocsParser";
import { parseGoogleSheet } from "./googleSheetsParser";
import { saveVectorData, deleteVectorsByDocumentId } from "./pineconeService";
import { getTrackingState, saveTrackingState } from "./documentTrackingService";

interface DriveDocument {
  documentId: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

/**
 * Entrena un documento `.gdoc` o `.gsheet` de Google Drive de forma global.
 * Solo se entrena si está desactualizado o es nuevo.
 * Agrega el chatbot a `usedByBots[]` del tracking.
 */
export async function trainGoogleDocForBot(doc: DriveDocument, chatbotId: string): Promise<void> {
  const tracking = await getTrackingState();
  const existing = tracking[doc.documentId];
  const docModified = new Date(doc.modifiedTime);

  if (existing) {
    const lastTrained = new Date(existing.trainedAt);

    if (lastTrained >= docModified) {
      if (!existing.usedByBots.includes(chatbotId)) {
        existing.usedByBots.push(chatbotId);
        tracking[doc.documentId] = existing;
        await saveTrackingState(tracking);
        console.log(`✅ Documento ya entrenado. Se agregó el bot '${chatbotId}' a usedByBots.`);
      } else {
        console.log("✅ Documento ya entrenado y bot ya registrado. No se requiere acción.");
      }
      return;
    }

    console.log(`🔁 Documento '${doc.documentId}' fue modificado. Reentrenando...`);

    await deleteVectorsByDocumentId(doc.documentId); // 🧹 limpieza por filtro
  }

  // 📥 Extraer texto según tipo MIME
  let textoPlano: string;
  if (doc.mimeType === "application/vnd.google-apps.document") {
    textoPlano = await parseGoogleDoc(doc.documentId);
  } else if (doc.mimeType === "application/vnd.google-apps.spreadsheet") {
    textoPlano = await parseGoogleSheet(doc.documentId);
  } else {
    throw new Error(`Tipo MIME no soportado para entrenamiento: ${doc.mimeType}`);
  }

  if (textoPlano.trim().length === 0) {
    console.warn(`⚠️ El documento '${doc.name}' tiene contenido vacío tras parseo. Se omite entrenamiento.`);
    return;
  }

  // 🧠 Generar embeddings y guardar (fragmenta internamente)
  await saveVectorData({
    id: doc.documentId,
    content: textoPlano,
    metadata: {
      filename: doc.name,
      documentId: doc.documentId,
      name: doc.name,
      mimeType: doc.mimeType,
      source: "gdrive",
      fragmentIndex: 0,
    },
  });

  // 🕒 Actualizar estado en documentTracking.json
  const ahora = new Date().toISOString();
  tracking[doc.documentId] = {
    documentId: doc.documentId,
    filename: doc.name,
    mimeType: doc.mimeType,
    trainedAt: ahora,
    usedByBots: existing?.usedByBots?.includes(chatbotId)
      ? existing.usedByBots
      : [...(existing?.usedByBots || []), chatbotId],
  };

  await saveTrackingState(tracking);
  console.log(`🚀 Documento '${doc.name}' entrenado y registrado correctamente.`);
}

