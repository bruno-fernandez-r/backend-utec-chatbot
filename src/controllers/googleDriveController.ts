// src/controllers/googleDriveController.ts

import { Request, Response } from 'express';
import { listFilesInFolder } from '../services/googleDriveService';

export const listGoogleDriveFiles = async (req: Request, res: Response) => {
  const folderId = req.query.folderId as string;

  if (!folderId) {
    return res.status(400).json({ error: 'El parámetro "folderId" es obligatorio en la query string.' });
  }

  try {
    console.log("📂 Listar archivos de Drive:", folderId); // ✅ agregado

    const files = await listFilesInFolder(folderId);

    if (files.length === 0) {
      return res.status(200).json({ message: 'No se encontraron archivos en la carpeta.', files: [] });
    }

    return res.status(200).json({ files });
  } catch (error) {
    console.error('❌ Error al listar archivos de Google Drive:', error);
    return res.status(500).json({ error: 'Ocurrió un error al obtener los archivos de Google Drive.' });
  }
};
