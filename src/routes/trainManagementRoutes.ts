/**
 * Ruta: trainManagementRoutes.ts
 * ------------------------------
 * Administra endpoints relacionados con la relación entre bots y documentos entrenados.
 * En esta versión incluye:
 *  - DELETE /train/:chatbotId/document/:documentId → desvincula un bot de un documento.
 */

import express from "express";
import { deleteBotFromDocument } from "../controllers/trainManagementController";

const router = express.Router();

// DELETE → Remueve el bot del documento entrenado y limpia si ya no lo usa nadie
router.delete("/train/:chatbotId/document/:documentId", deleteBotFromDocument);

export default router;
