// Objetivo: Define endpoints de consulta y análisis sobre el estado de entrenamiento de los chatbots

import express from "express";
import { getBotFragments } from "../controllers/trainingAnalyticsController";
import { getTrainedDocumentsFromDrive } from "../controllers/googleTrainingController";

const router = express.Router();

/**
 * 📊 GET /train/:chatbotId/fragments
 * Lista los fragmentos vectoriales asociados a un documento (opcional)
 * Parámetro opcional: ?documentId=...
 */
router.get("/:chatbotId/fragments", getBotFragments);

/**
 * 📄 GET /train/:chatbotId/documents
 * Devuelve los documentos entrenados por un bot con nombres legibles
 */
router.get("/:chatbotId/documents", getTrainedDocumentsFromDrive);

export default router;
