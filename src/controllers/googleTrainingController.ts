import { Request, Response } from "express";
import { parseGoogleDoc } from "../services/googleDocsParser";
import { parseGoogleSheet } from "../services/googleSheetsParser";
import { saveVectorData } from "../services/pineconeService";
import { updateTrackingRecord } from "../services/documentTrackingService";

/**
 * Entrena un chatbot a partir de un archivo de Google Drive (.gdoc o .gsheet).
 * Requiere `chatbotId`, `fileId`, `mimeType` y `name` en el body.
 */
export const trainFromDrive = async (req: Request, res: Response): Promise<Response> => {
  console.log("📩 Solicitud recibida para entrenamiento desde Google Drive.");
  console.log("🧪 req.body:", req.body);

  const { chatbotId, fileId, mimeType, name } = req.body;

  if (!chatbotId?.trim() || !fileId?.trim() || !mimeType?.trim() || !name?.trim()) {
    return res.status(400).json({
      error: "Faltan parámetros requeridos: chatbotId, fileId, mimeType y name.",
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

    // 🧠 Guardar vectores en Pinecone (fragmentación interna)
    await saveVectorData({
      id: fileId, // ← documentId (clave técnica en Pinecone)
      content: fullText,
      chatbotId,
      metadata: {
        filename: name,      // ← nombre legible para humanos
        documentId: fileId,  // ← redundante en metadata para trazabilidad
        name,
        mimeType,
        source: "gdrive",
      },
    });

    // 📁 Registrar en documentTracking.json
    await updateTrackingRecord({
      documentId: fileId,
      filename: name,
      mimeType,
      chatbotId,
    });

    return res.status(200).json({
      success: true,
      message: "✅ Entrenamiento completado y registrado correctamente.",
    });
  } catch (error) {
    console.error("❌ Error durante el entrenamiento:", error);
    return res.status(500).json({
      error: "No se pudo completar el entrenamiento desde el archivo.",
    });
  }
};
