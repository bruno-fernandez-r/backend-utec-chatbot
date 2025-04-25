import OpenAI from "openai";
import * as dotenv from "dotenv";
import { getHistory, appendHistory, Message } from "./conversationMemory";
import { ChatCompletionMessageParam } from "openai/resources/chat";
import { getChatbotById } from "../services/chatbotService";
import { getPrompt } from "../services/promptService";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    console.log("📌 Generando embeddings...");
    const response = await openai.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL!,
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("❌ Error generando embeddings:", error);
    throw new Error("Error generando embeddings.");
  }
}

export async function generateResponse(
  userQuery: string,
  context: string = "",
  sessionId: string = "default",
  chatbotId: string
): Promise<string> {
  try {
    console.log("📥 Generando respuesta para chatbot:", chatbotId);

    // 🧠 Obtener el prompt del chatbot desde Azure Blob
    const prompt = await getPrompt(chatbotId);
    if (!prompt) {
      console.warn(`⚠️ Prompt no encontrado para chatbotId=${chatbotId}, usando valor por defecto.`);
    }

    // ⚙️ Obtener configuración del chatbot desde Azure Table Storage
    const chatbotConfig = await getChatbotById(chatbotId);
    if (!chatbotConfig) {
      console.error(`❌ Chatbot no encontrado en Table Storage: ${chatbotId}`);
      return "No se encontró la configuración del chatbot solicitado.";
    }

    // 📚 Contexto procesado
    const cleanContext = context.trim().length > 0
      ? `Aquí tienes la información disponible:\n\n${context}`
      : "No se encontraron datos relevantes para responder esta consulta.";

    // 📜 Historial de conversación
    const history: Message[] = await getHistory(sessionId);
    const historyMessages: ChatCompletionMessageParam[] = history.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // 🧠 Armar mensajes para OpenAI
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: prompt || "Eres un asistente virtual de UTEC." },
      { role: "system", content: cleanContext },
      ...historyMessages,
      { role: "user", content: userQuery }
    ];

    // 🧪 Enviar a OpenAI
    const response = await openai.chat.completions.create({
      model: chatbotConfig.model || "gpt-4o",
      messages,
      max_tokens: chatbotConfig.maxTokens || 500,
      temperature: chatbotConfig.temperature ?? 0.4,
    });

    const reply = response.choices[0]?.message?.content || "No tengo información suficiente.";

    // 💾 Guardar en historial
    await appendHistory(sessionId, { role: "user", content: userQuery });
    await appendHistory(sessionId, { role: "assistant", content: reply });

    return reply;
  } catch (error) {
    console.error("❌ Error generando respuesta con OpenAI:", error);
    return "Hubo un error generando la respuesta.";
  }
}
