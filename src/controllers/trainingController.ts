import { Request, Response } from "express";
import pdfParse from "pdf-parse";
import fs from "fs";
import path from "path";
import os from "os";
import { AzureBlobService } from "../services/azureBlobService";
import {
  documentExistsInPinecone,
  deleteVectorsManualmente,
  saveVectorData,
  listDocumentsByChatbot,
} from "../services/pineconeService";
import { updateTrackingRecord } from "../services/documentTrackingService";

/**
 * Entrena un chatbot a partir de un archivo PDF almacenado en Azure.
 * Extrae el texto completo y guarda los vectores en Pinecone.
 */
export const train = async (req: Request, res: Response) => {
  const { filename } = req.params;
  const chatbotId = req.query.chatbotId as string;

  if (!chatbotId) {
    return res.status(400).json({
      error: 'El parámetro "chatbotId" es requerido en la query string.',
    });
  }

  try {
    console.log(`📥 Iniciando entrenamiento para archivo '${filename}' (chatbot: ${chatbotId})`);

    // 1. Descargar archivo desde Azure
    const fileBuffer = await AzureBlobService.downloadFile(filename);
    if (!fileBuffer) {
      return res.status(404).json({ error: `El archivo '${filename}' no fue encontrado en Azure.` });
    }

    // 2. Guardar temporalmente para procesar
    const tempPath = path.join(os.tmpdir(), filename);
    fs.writeFileSync(tempPath, fileBuffer);

    // 3. Verificar si ya fue entrenado → limpiar si corresponde
    const yaExiste = await documentExistsInPinecone(filename, chatbotId);
    if (yaExiste) {
      console.log(`🧹 Eliminando vectores anteriores de ${filename} para chatbot ${chatbotId}`);
      await deleteVectorsManualmente(filename, chatbotId);
    }

    // 4. Leer y extraer texto del PDF
    const pdfData = await pdfParse(fs.readFileSync(tempPath));
    const pdfText = pdfData.text?.trim();
    fs.unlinkSync(tempPath);

    if (!pdfText) {
      return res.status(400).json({ error: "El PDF no contiene texto procesable." });
    }

    // 5. Guardar vectores con fragmentación automática
    await saveVectorData({
      id: filename, // ← documentId técnico (nombre del PDF)
      content: pdfText,
      chatbotId,
      metadata: {
        filename,                     // nombre legible visible
        documentId: filename,         // redundante en metadata para trazabilidad
        name: path.parse(filename).name,
        mimeType: "application/pdf",
        source: "azure",
      },
    });

    // 6. Registrar en documentTracking.json
    await updateTrackingRecord({
      documentId: filename,
      filename,
      mimeType: "application/pdf",
      chatbotId,
    });

    return res.status(200).json({ message: "📚 Entrenamiento exitoso con el archivo PDF." });
  } catch (error) {
    console.error("❌ Error durante el entrenamiento:", error);
    return res.status(500).json({ error: "Error al entrenar el modelo con el archivo." });
  }
};

/**
 * Devuelve la lista de documentos entrenados por un chatbot.
 */
export const getTrainedDocuments = async (req: Request, res: Response) => {
  const { chatbotId } = req.params;

  if (!chatbotId) {
    return res.status(400).json({ error: "chatbotId es requerido en la ruta." });
  }

  try {
    const documents = await listDocumentsByChatbot(chatbotId);
    res.status(200).json({ chatbotId, documents });
  } catch (error) {
    console.error("❌ Error obteniendo documentos entrenados:", error);
    res.status(500).json({ error: "Error al obtener los documentos entrenados." });
  }
};
