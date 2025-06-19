/**
 * Ruta: pineconeInspectionRoutes.ts
 * ----------------------------------
 * Define las rutas relacionadas con inspección directa de vectores en Pinecone.
 */

import { Router } from "express";
import { getVectorCountForDocument } from "../controllers/pineconeInspectionController";

const router = Router();

// GET /pinecone/document/:documentId/count
router.get("/pinecone/document/:documentId/count", getVectorCountForDocument);

export default router;
