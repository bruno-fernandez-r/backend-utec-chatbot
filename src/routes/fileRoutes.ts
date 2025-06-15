/**
 * fileRoutes.ts
 * ------------------
 * Rutas para gestionar archivos PDF en Azure Blob Storage.
 * Permite subir, listar, eliminar y descargar archivos.
 */

import express from "express";
import multer from "multer";
import os from "os";
import {
  uploadFile,
  listFiles,
  deleteFile,
  downloadFile
} from "../controllers/fileController"; // ✅ corregido: era 'filesController'

const router = express.Router();

// 📁 Configuración de multer para almacenar archivos temporales en el sistema operativo
const upload = multer({ dest: os.tmpdir() });

// 🔼 Subir archivo PDF (requiere campo 'file' en el form-data)
router.post("/upload", upload.single("file"), uploadFile);

// 📄 Listar archivos disponibles en Azure
router.get("/", listFiles);

// 🗑️ Eliminar archivo por nombre (también borra vectores asociados en Pinecone)
router.delete("/:filename", deleteFile);

// ⬇️ Descargar archivo por nombre
router.get("/:filename/download", downloadFile);

export default router;
