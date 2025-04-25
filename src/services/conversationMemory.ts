// src/services/conversationMemory.ts

import Redis from 'ioredis';

export type Message = { role: "user" | "assistant"; content: string };

const redis = new Redis(process.env.REDIS_URL || '');

const TTL_SECONDS = 1800; // 30 minutos

function getRedisKey(sessionId: string): string {
  return `session:${sessionId}`;  // ✅ esta era la línea con error
}

export async function getHistory(sessionId: string): Promise<Message[]> {
  const data = await redis.get(getRedisKey(sessionId));
  return data ? JSON.parse(data) : [];
}

export async function appendHistory(sessionId: string, message: Message): Promise<void> {
  const history = await getHistory(sessionId);
  const updated = [...history, message].slice(-10); // 5 pares usuario/asistente
  await redis.set(getRedisKey(sessionId), JSON.stringify(updated), 'EX', TTL_SECONDS);
}
