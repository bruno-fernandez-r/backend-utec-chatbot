import { Request, Response } from "express";
import { parseGoogleDoc } from "../services/googleDocsParser";
import { parseGoogleSheet } from "../services/googleSheetsParser";
import { saveVectorData } from "../services/pineconeService";

/**
 * Entrena un chatbot a partir de un archivo de Google Drive (.gdoc o .gsheet).
 * Requiere `chatbotId`, `fileId` y `mimeType` en el body.
 */
export const trainFromDrive = async (req: Request, res: Response): Promise<Response> => {
  console.log("📩 Solicitud recibida para entrenamiento desde Google Drive.");

  // 🧪 Diagnóstico de los datos entrantes
  console.log("🧪 req.query:", req.query);
  console.log("🧪 req.body:", req.body);

  const { chatbotId, fileId, mimeType } = req.body;

  console.log("🔹 chatbotId:", chatbotId);
  console.log("🔹 fileId:", fileId);
  console.log("🔹 mimeType:", mimeType);

  // Validación
  if (!chatbotId?.trim() || !fileId?.trim() || !mimeType?.trim()) {
    return res.status(400).json({
      error: "Faltan parámetros requeridos: chatbotId, fileId y mimeType.",
    });
  }

  try {
    let fullText = "";

    switch (mimeType) {
      case "application/vnd.google-apps.document":
        fullText = await parseGoogleDoc(fileId);
        break;

      case "application/vnd.google-apps.spreadsheet":
        fullText = await parseGoogleSheet(fileId);
        break;

      default:
        return res.status(400).json({
          error: `Tipo de archivo no soportado para entrenamiento: ${mimeType}`,
        });
    }

    await saveVectorData(fileId, fullText, chatbotId);

    return res.status(200).json({
      success: true,
      message: "✅ Entrenamiento completado exitosamente desde Google Drive.",
    });
  } catch (error) {
    console.error("❌ Error durante el entrenamiento:", error);
    return res.status(500).json({
      error: "No se pudo completar el entrenamiento desde el archivo.",
    });
  }
};
