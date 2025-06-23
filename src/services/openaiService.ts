// Servicio: openaiService.ts
// --------------------------
// Genera embeddings y respuestas usando Azure OpenAI, con configuración separada para cada tipo de modelo.

import * as dotenv from "dotenv";
import { getHistory, appendHistory, Message } from "./conversationMemory";
import { ChatCompletionMessageParam } from "openai/resources/chat";
import { getChatbotById } from "./chatbotService";
import { getPrompt } from "./promptService";
import OpenAI from "openai";

dotenv.config();

// 🧠 Cliente Azure OpenAI para embeddings
const openaiEmbeddings = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT}`,
  defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION! },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY! },
});

// 💬 Cliente Azure OpenAI para chat
const openaiChat = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_CHAT_DEPLOYMENT}`,
  defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION! },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY! },
});

// 🔹 Genera embeddings desde texto (máx. 8192 tokens de entrada)
export async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    console.log("📌 Generando embeddings con Azure OpenAI...");

    const response = await openaiEmbeddings.embeddings.create({
      model: "text-embedding-3-small", // Obligatorio para tipos, ignorado por Azure
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("❌ Error generando embeddings:", error);
    throw new Error("Error generando embeddings.");
  }
}

// 🔹 Genera una respuesta conversacional basada en contexto y sesión
export async function generateResponse(
  userQuery: string,
  context: string = "",
  sessionId: string = "default",
  chatbotId: string
): Promise<string> {
  try {
    console.log("📥 Generando respuesta para chatbot:", chatbotId);

    const prompt = await getPrompt(chatbotId);
    if (!prompt) console.warn(`⚠️ Prompt no encontrado para chatbotId=${chatbotId}, usando valor por defecto.`);

    const chatbotConfig = await getChatbotById(chatbotId);
    if (!chatbotConfig) {
      console.error(`❌ Chatbot no encontrado: ${chatbotId}`);
      return "No se encontró la configuración del chatbot solicitado.";
    }

    const cleanContext = context.trim().length > 0
      ? `Aquí tienes la información disponible:\n\n${context}`
      : "No se encontraron datos relevantes para responder esta consulta.";

    const history: Message[] = await getHistory(sessionId);
    const historyMessages: ChatCompletionMessageParam[] = history.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: prompt || "Eres un asistente virtual de UTEC." },
      { role: "system", content: cleanContext },
      ...historyMessages,
      { role: "user", content: userQuery },
    ];

    const response = await openaiChat.chat.completions.create({
      model: "gpt-4o", // Obligatorio para tipos, ignorado por Azure
      messages,
      max_tokens: chatbotConfig.maxTokens || 500,
      temperature: chatbotConfig.temperature ?? 0.4,
    });

    const reply = response.choices[0]?.message?.content || "No tengo información suficiente.";

    await appendHistory(sessionId, { role: "user", content: userQuery });
    await appendHistory(sessionId, { role: "assistant", content: reply });

    return reply;
  } catch (error) {
    console.error("❌ Error generando respuesta con Azure OpenAI:", error);
    return "Hubo un error generando la respuesta.";
  }
}
