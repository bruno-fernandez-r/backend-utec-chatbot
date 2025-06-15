/**
 * Servicio: googleTrainingService.ts
 * -----------------------------------
 * Este servicio entrena un documento de Google Drive para un chatbot específico.
 *
 * Flujo:
 * 1. Verifica si el bot ya entrenó el documento y si está actualizado.
 * 2. Si está desactualizado, elimina los vectores previos en Pinecone.
 * 3. Extrae el texto del documento (.gdoc o .gsheet) y lo fragmenta.
 * 4. Calcula embeddings y guarda los vectores nuevos usando la nueva firma de `saveVectorData`.
 * 5. Actualiza el archivo documentTracking.json con metadata y `trainedAt`.
 */

import { parseGoogleDoc } from "./googleDocsParser";
import { generateEmbeddings } from "./openaiService";
import { saveVectorData, deleteVectorsManualmente } from "./pineconeService";
import { getDocumentTracking, saveDocumentTracking } from "./documentTrackingService";

interface DriveDocument {
  documentId: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

/**
 * Entrena un documento `.gdoc` de Google Drive para un bot específico.
 * Si está desactualizado, elimina vectores previos y entrena nuevamente.
 */
export async function trainGoogleDocForBot(doc: DriveDocument, chatbotId: string): Promise<void> {
  const tracking = await getDocumentTracking();
  const existing = tracking.find(d => d.documentId === doc.documentId);
  const docModified = new Date(doc.modifiedTime);

  if (existing && existing.usedByBots?.includes(chatbotId)) {
    const lastTrained = new Date(existing.trainedAt);
    if (lastTrained >= docModified) return; // ✅ Ya actualizado

    // 🔄 Borrar vectores desactualizados
    await deleteVectorsManualmente(doc.documentId, chatbotId);
  }

  // 📥 Extraer texto desde Google Docs
  const textoPlano = await parseGoogleDoc(doc.documentId);

  // 🧩 Fragmentar por párrafos dobles
  const fragmentos = textoPlano
    .split(/\n{2,}/g)
    .map(f => f.trim())
    .filter(f => f.length > 0);

  // 🧠 Generar embeddings y guardar cada fragmento
  for (const [i, fragmento] of fragmentos.entries()) {
    await saveVectorData({
      id: doc.documentId,
      content: fragmento,
      chatbotId,
      metadata: {
        name: doc.name,
        mimeType: doc.mimeType,
        source: "gdrive",
        fragmentIndex: i
      }
    });
  }

  // 🕒 Actualizar metadata en el tracking
  const ahora = new Date().toISOString();

  if (existing) {
    existing.trainedAt = ahora;
    existing.name = doc.name;
    existing.mimeType = doc.mimeType;
    if (!existing.usedByBots.includes(chatbotId)) {
      existing.usedByBots.push(chatbotId);
    }
  } else {
    tracking.push({
      documentId: doc.documentId,
      name: doc.name,
      mimeType: doc.mimeType,
      trainedAt: ahora,
      usedByBots: [chatbotId]
    });
  }

  await saveDocumentTracking(tracking);
}
