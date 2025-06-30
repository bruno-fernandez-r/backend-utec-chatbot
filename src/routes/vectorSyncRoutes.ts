/**
 * Rutas: vectorSyncRoutes.ts
 * ---------------------------
 * Define las rutas relacionadas a la sincronización de vectores con Pinecone.
 * Endpoint principal:
 *   - POST /sync-vectors
 */

import express from "express";
import { syncVectorRegistry } from "../controllers/syncVectorsController";

const router = express.Router();

router.post("/sync-vectors", syncVectorRegistry);

export default router;
