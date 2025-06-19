// Objetivo: Gestiona el entrenamiento de documentos desde Google Drive para chatbots y la consulta de documentos entrenados

import { Request, Response } from "express";
import { trainGoogleDocForBot } from "../services/googleTrainingService";
import { google } from "googleapis";
import { getTrackingState } from "../services/documentTrackingService";
import { getChatbotById } from "../services/chatbotService";

/**
 * POST /drive-train/single
 * Entrena un documento de Google Drive (.gdoc o .gsheet) para un bot.
 * Si ya fue entrenado y no fue modificado, no repite el proceso.
 */
export const trainSingleGoogleDoc = async (req: Request, res: Response) => {
  try {
    const { chatbotId, fileId, name, mimeType } = req.body;

    if (!chatbotId || !fileId || !name || !mimeType) {
      console.warn("⚠️ Parámetros faltantes.");
      return res.status(400).json({
        error: "Faltan parámetros requeridos: chatbotId, fileId, name o mimeType.",
      });
    }

    const mimeAllowed = [
      "application/vnd.google-apps.document",
      "application/vnd.google-apps.spreadsheet"
    ];

    if (!mimeAllowed.includes(mimeType)) {
      return res.status(400).json({
        error: `El tipo MIME '${mimeType}' no está soportado para entrenamiento. Solo se aceptan Google Docs y Google Sheets.`,
      });
    }

    console.log(`📥 Entrenando documento '${name}' (ID: ${fileId}) para bot ${chatbotId}`);

    const base64 = process.env.GOOGLE_CREDENTIALS_BASE64;
    if (!base64) {
      console.error("❌ GOOGLE_CREDENTIALS_BASE64 no está definida.");
      return res.status(500).json({ error: "Faltan credenciales de Google para autenticación." });
    }

    const credentials = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });
    const { data } = await drive.files.get({
      fileId,
      fields: "modifiedTime",
    });

    const modifiedTime = data.modifiedTime;
    if (!modifiedTime) {
      console.error("❌ No se obtuvo 'modifiedTime' del documento.");
      return res.status(400).json({
        error: "No se pudo obtener la fecha de modificación del documento en Google Drive.",
      });
    }

    await trainGoogleDocForBot(
      {
        documentId: fileId,
        name,
        mimeType,
        modifiedTime,
      },
      chatbotId
    );

    console.log(`✅ Entrenamiento completado o innecesario para '${name}'`);
    return res.status(200).json({ message: "Entrenamiento completado o no requerido." });

  } catch (error: any) {
    console.error("❌ Error en trainSingleGoogleDoc:", error?.response?.data || error?.message || error);
    return res.status(500).json({ error: "Error al entrenar documento." });
  }
};

/**
 * GET /train/:chatbotId/documents
 * Devuelve los documentos entrenados por un bot, con nombre legible y ID.
 */
export const getTrainedDocumentsFromDrive = async (req: Request, res: Response) => {
  const { chatbotId } = req.params;

  if (!chatbotId) {
    return res.status(400).json({ error: "chatbotId es requerido en la ruta." });
  }

  try {
    const bot = await getChatbotById(chatbotId);
    if (!bot) {
      return res.status(404).json({ error: `No se encontró el chatbot con ID '${chatbotId}'` });
    }

    const tracking = await getTrackingState();

    const documentos = Object.entries(tracking)
      .filter(([_, entry]) => entry.usedByBots.includes(chatbotId))
      .map(([documentId, entry]) => ({
        documentId,
        name: entry.name,
      }));

    return res.status(200).json({
      chatbotId,
      chatbotName: bot.name,
      documents: documentos,
    });
  } catch (error) {
    console.error("❌ Error al obtener documentos entrenados:", error);
    return res.status(500).json({ error: "Error interno al obtener documentos entrenados." });
  }
};
