/**
 * server.ts
 * ------------------
 * Punto de entrada principal del backend de Chatbot UTEC.
 * Configura middlewares globales, carga las rutas disponibles y levanta el servidor Express.
 */

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

// 📦 Rutas del sistema
import chatbotRoutes from "./routes/chatbotRoutes";
import chatRoutes from "./routes/chatRoutes";
import googleDriveRoutes from "./routes/googleDriveRoutes";
import googleTrainingRoutes from "./routes/googleTrainingRoutes";
import trainManagementRoutes from "./routes/trainManagementRoutes";
import trainingAnalyticsRoutes from "./routes/trainingAnalyticsRoutes";
import pineconeInspectionRoutes from "./routes/pineconeInspectionRoutes";


const app = express();
const PORT = process.env.PORT || 3000;

// 🌐 Middlewares globales
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ type: ["application/json", "text/plain"] }));
app.use(cors());

// ✅ Ruta simple para monitoreo del servidor
app.get("/", (_req, res) => {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("🤖 Chatbot UTEC operativo - Versión Redis");
});

// 📌 Rutas principales del sistema
app.use("/chatbots", chatbotRoutes);              // Gestión de bots                // Subida, listado, descarga y borrado de PDFs
app.use("/chat", chatRoutes);                     // Interacción del chat               // Entrenamiento desde PDFs en Azure
app.use("/google-drive", googleDriveRoutes);      // Exploración de archivos en Google Drive
app.use("/drive-train", googleTrainingRoutes);    // Entrenamiento desde Google Drive
app.use("/", trainManagementRoutes);              // Gestión avanzada de entrenamiento
app.use("/train", trainingAnalyticsRoutes);
app.use("/", pineconeInspectionRoutes);


// 🚀 Arranque del servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});


