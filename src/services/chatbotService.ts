import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import { Chatbot, ChatbotEditable } from "../models/chatbotModel";
import { v4 as uuidv4 } from "uuid";
import { removeChatbotFromTracking } from "./documentTrackingService"; // ✅ nueva importación

// ✅ Validación segura de entorno
const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const tableName = process.env.AZURE_TABLE_NAME;

if (!account || !accountKey || !tableName) {
  throw new Error("❌ Variables de entorno de Azure Table Storage no definidas.");
}

const credential = new AzureNamedKeyCredential(account, accountKey);
const client = new TableClient(
  `https://${account}.table.core.windows.net`,
  tableName,
  credential
);

export async function createChatbot(data: ChatbotEditable): Promise<Chatbot> {
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  const entity = {
    partitionKey: "chatbots",
    rowKey: id,
    name: data.name,
    description: data.description ?? "",
    model: data.model ?? "gpt-4o",
    temperature: data.temperature ?? 0.5,
    maxTokens: data.maxTokens ?? 500,
    createdAt,
  };

  await client.createEntity(entity);

  return {
    id,
    name: entity.name,
    description: entity.description,
    model: entity.model,
    temperature: entity.temperature,
    maxTokens: entity.maxTokens,
    createdAt,
  };
}

export async function getAllChatbots(): Promise<Chatbot[]> {
  const chatbots: Chatbot[] = [];

  for await (const entity of client.listEntities({ queryOptions: { filter: `PartitionKey eq 'chatbots'` } })) {
    chatbots.push({
      id: entity.rowKey as string,
      name: entity.name as string,
      description: entity.description as string,
      model: entity.model as string,
      temperature: Number(entity.temperature),
      maxTokens: Number(entity.maxTokens),
      createdAt: entity.createdAt as string,
    });
  }

  return chatbots;
}

export async function getChatbotById(id: string): Promise<Chatbot | null> {
  try {
    const entity = await client.getEntity("chatbots", id);
    return {
      id: entity.rowKey as string,
      name: entity.name as string,
      description: entity.description as string,
      model: entity.model as string,
      temperature: Number(entity.temperature),
      maxTokens: Number(entity.maxTokens),
      createdAt: entity.createdAt as string,
    };
  } catch {
    return null;
  }
}

export async function getChatbotByName(name: string): Promise<Chatbot | null> {
  for await (const entity of client.listEntities({
    queryOptions: {
      filter: `PartitionKey eq 'chatbots' and name eq '${name}'`
    }
  })) {
    return {
      id: entity.rowKey as string,
      name: entity.name as string,
      description: entity.description as string,
      model: entity.model as string,
      temperature: Number(entity.temperature),
      maxTokens: Number(entity.maxTokens),
      createdAt: entity.createdAt as string,
    };
  }

  return null;
}

export async function updateChatbot(id: string, updates: Partial<ChatbotEditable>): Promise<Chatbot | null> {
  const existing = await getChatbotById(id);
  if (!existing) return null;

  if (updates.name && updates.name !== existing.name) {
    const sameName = await getChatbotByName(updates.name);
    if (sameName) throw new Error("DUPLICATE_NAME");
  }

  const updated = {
    ...existing,
    ...updates,
  };

  const entity = {
    partitionKey: "chatbots",
    rowKey: id,
    name: updated.name,
    description: updated.description ?? "",
    model: updated.model ?? "gpt-4o",
    temperature: updated.temperature ?? 0.5,
    maxTokens: updated.maxTokens ?? 500,
    createdAt: updated.createdAt,
  };

  await client.upsertEntity(entity, "Replace");

  return updated;
}

export async function deleteChatbot(id: string): Promise<boolean> {
  try {
    await client.deleteEntity("chatbots", id);
    await removeChatbotFromTracking(id); // ✅ limpieza de tracking, vectores y documentId.json
    return true;
  } catch {
    return false;
  }
}
