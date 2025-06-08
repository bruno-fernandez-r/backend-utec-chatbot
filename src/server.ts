import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

// Rutas del sistema
import chatbotRoutes from './routes/chatbotRoutes';
import filesRoutes from './routes/filesRoutes';
import trainingRoutes from './routes/trainingRoutes';
import chatRoutes from './routes/chatRoutes';
import googleDriveRoutes from './routes/googleDriveRoutes';
import googleTrainingRoutes from './routes/googleTrainingRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ type: ['application/json', 'text/plain'] }));
app.use(cors());

// 🟢 Ruta de estado del servidor
app.get('/', (req, res) => {
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send('🤖 Chatbot UTEC operativo - Versión Redis');
});

// Rutas de la API
app.use('/chatbots', chatbotRoutes);
app.use('/files', filesRoutes);
app.use('/chat', chatRoutes);
app.use('/train', trainingRoutes);                    // Entrenamiento Azure/PDF
app.use('/google-drive', googleDriveRoutes);          // Listado de archivos
app.use('/drive-train', googleTrainingRoutes);        // ✅ NUEVO: Entrenamiento Google Drive separado

// Inicio del servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

