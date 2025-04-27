import express from "express";
import {
  getAllChatbots,
  getChatbotById,
  createChatbot,
  updateChatbot,
  deleteChatbot,
  getPrompt,
  updatePrompt,
  deletePrompt,
} from "../controllers/chatbotController";

const router = express.Router();

// 🟩 Prompt endpoints primero
router.get("/:id/prompt", getPrompt);
router.put("/:id/prompt", updatePrompt);
router.delete("/:id/prompt", deletePrompt);

// 🟦 CRUD general
router.get("/", getAllChatbots);
router.get("/:id", getChatbotById);
router.post("/", createChatbot);
router.put("/:id", updateChatbot);
router.delete("/:id", deleteChatbot);


console.log("📡 chatbotRoutes cargado");

export default router;
