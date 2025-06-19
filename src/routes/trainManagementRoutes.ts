/**
 * Rutas: trainManagementRoutes.ts
 * --------------------------------
 * Define las rutas para operaciones de gestión del entrenamiento:
 * olvidar documentos por bot, eliminar todos los vectores de un documento,
 * purgar todo el sistema, verificar estado y sincronizar bots.
 */

import { Router } from "express";
import {
  deleteBotFromDocument,
  deleteDocumentFromAllBots,
  purgeAllTrainingData,
  getDocumentStatus,
} from "../controllers/trainManagementController";

const router = Router();

// DELETE /train/:chatbotId/document/:documentId
router.delete("/train/:chatbotId/document/:documentId", deleteBotFromDocument);

// DELETE /train/document/:documentId
router.delete("/train/document/:documentId", deleteDocumentFromAllBots);

// DELETE /train/purge/all
router.delete("/train/purge/all", purgeAllTrainingData);

// GET /train/:chatbotId/status/:documentId
router.get("/train/:chatbotId/status/:documentId", getDocumentStatus);


export default router;
