/**
 * fileController.ts
 * ------------------
 * Controlador para gestionar archivos PDF en Azure Blob Storage.
 * Permite subir, listar, descargar y eliminar archivos. Al eliminar, también limpia vectores en Pinecone
 * asociados a bots entrenados con ese archivo.
 */

import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { AzureBlobService } from "../services/azureBlobService";
import {
  deleteVectorsManualmente,
  findChatbotsByDocumentId
} from "../services/pineconeService";

const ALLOWED_EXTENSIONS = [".pdf"];

export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Debe subir un archivo con el campo 'file'." });
    }

    const tempPath = req.file.path;
    const originalName = req.file.originalname;
    const fileExt = path.extname(originalName).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      fs.unlinkSync(tempPath); // eliminar archivo si es inválido
      return res.status(400).json({ error: "Solo se permiten archivos PDF (.pdf)." });
    }

    const fileBuffer = fs.readFileSync(tempPath);
    await AzureBlobService.uploadFile(fileBuffer, originalName);
    fs.unlinkSync(tempPath);

    console.log(`✅ Archivo '${originalName}' subido correctamente a Azure Blob`);
    res.status(200).json({ message: "Archivo subido correctamente a Azure.", filename: originalName });
  } catch (error) {
    console.error("❌ Error al subir archivo:", error);
    res.status(500).json({ error: "Error al subir el archivo a Azure." });
  }
};

export const listFiles = async (_req: Request, res: Response) => {
  try {
    const files = await AzureBlobService.listFiles();
    res.status(200).json({ files });
  } catch (error) {
    console.error("❌ Error al listar archivos:", error);
    res.status(500).json({ error: "Error al listar archivos." });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  const { filename } = req.params;

  try {
    console.log(`🗑️ Eliminando archivo '${filename}'...`);

    // Buscar todos los bots que usaron este archivo como entrenamiento
    const chatbotIds = await findChatbotsByDocumentId(filename);

    for (const chatbotId of chatbotIds) {
      console.log(`🧹 Eliminando vectores del archivo '${filename}' para chatbot '${chatbotId}'`);
      await deleteVectorsManualmente(filename, chatbotId);
    }

    await AzureBlobService.deleteFile(filename);
    console.log(`✅ Archivo '${filename}' eliminado de Azure Blob Storage.`);

    res.status(200).json({
      message: `Archivo '${filename}' y sus vectores asociados fueron eliminados correctamente.`,
      affectedBots: chatbotIds,
    });
  } catch (error) {
    console.error("❌ Error al eliminar archivo:", error);
    res.status(500).json({ error: "Error al eliminar el archivo." });
  }
};

export const downloadFile = async (req: Request, res: Response) => {
  const { filename } = req.params;
  try {
    const fileBuffer = await AzureBlobService.downloadFile(filename);

    if (!fileBuffer) {
      return res.status(404).json({ error: `Archivo '${filename}' no encontrado.` });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(fileBuffer);
  } catch (error) {
    console.error("❌ Error al descargar archivo:", error);
    res.status(500).json({ error: "Error al descargar el archivo." });
  }
};
