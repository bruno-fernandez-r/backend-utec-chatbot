// src/routes/googleDriveRoutes.ts

import express from 'express';
import { listGoogleDriveFiles } from '../controllers/googleDriveController';

const router = express.Router();

/**
 * 📄 Listar archivos desde una carpeta de Google Drive
 * Ejemplo: GET /google-drive/list?folderId=ID
 */
router.get('/list', listGoogleDriveFiles);

export default router;
