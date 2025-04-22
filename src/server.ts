import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import chatbotRoutes from './routes/chatbotRoutes';
import filesRoutes from './routes/filesRoutes';
import trainingRoutes from './routes/trainingRoutes';
import chatRoutes from './routes/chatRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ type: ['application/json', 'text/plain'] }));
app.use(cors());

// 🟢 Ruta raíz que muestra el estado del bot
app.get('/', (req, res) => {
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send('🤖 Chatbot UTEC operativo 2.0');
});

app.use('/files', filesRoutes);
app.use('/train', trainingRoutes);
app.use('/chat', chatRoutes);
app.use('/chatbots', chatbotRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
