import { Request, Response } from 'express';
import { listFilesInFolder } from '../services/googleDriveService';
import { getTrackingState } from '../services/documentTrackingService';

export const listGoogleDriveFiles = async (req: Request, res: Response) => {
  const folderId = req.query.folderId as string;

  if (!folderId) {
    return res.status(400).json({ error: 'El parámetro "folderId" es obligatorio en la query string.' });
  }

  try {
    console.log("📂 Listar archivos de Drive:", folderId);

    // 1. Obtener archivos desde Google Drive con modifiedTime
    const files = await listFilesInFolder(folderId);

    // 2. Obtener estado actual de entrenamiento desde el tracking
    const tracking = await getTrackingState();

    // 3. Enriquecer cada archivo con estado de entrenamiento
    const enrichedFiles = files.map(file => {
      const { documentId, name, mimeType, modifiedTime } = file;
      const modifiedDate = new Date(modifiedTime);
      const trackedEntry = tracking[documentId];

      let status: string;

      if (!trackedEntry) {
        status = "Pendiente de Indexación";
      } else {
        const trainedAt = new Date(trackedEntry.trainedAt);
        status = trainedAt < modifiedDate ? "Requiere nueva sincronizacion" : "Indexado y Vigente";
      }

      return {
        documentId,
        name,
        mimeType,
        modifiedTime,
        status
      };
    });

    return res.status(200).json({ files: enrichedFiles });
  } catch (error) {
    console.error('❌ Error al listar archivos de Google Drive:', error);
    return res.status(500).json({ error: 'Ocurrió un error al obtener los archivos de Google Drive.' });
  }
};
