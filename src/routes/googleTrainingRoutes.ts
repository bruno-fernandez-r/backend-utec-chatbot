// Objetivo: Define los endpoints de entrenamiento desde Google Drive y consulta de documentos entrenados

import express from 'express';
import {
  trainSingleGoogleDoc,
  getTrainedDocumentsFromDrive
} from '../controllers/googleTrainingController';

const router = express.Router();

// POST /drive-train/single → Entrena un documento de Google Drive para un bot
router.post('/single', trainSingleGoogleDoc);

export default router;
