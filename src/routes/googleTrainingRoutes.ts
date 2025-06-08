import express from 'express';
import { trainFromDrive } from '../controllers/googleTrainingController';

const router = express.Router();

// POST /drive-train/single
router.post('/single', trainFromDrive);

export default router;
