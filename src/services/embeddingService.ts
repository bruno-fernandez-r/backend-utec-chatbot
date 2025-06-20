/**
 * Servicio: embeddingService.ts
 * ------------------------------
 * Encapsula la generación de embeddings para múltiples fragmentos de texto,
 * utilizando el modelo OpenAI 'text-embedding-3-small' desde openaiService.ts.
 */

import { generateEmbeddings } from "./openaiService";

/**
 * Representa un fragmento de texto al que se le generará embedding.
 */
export interface TextFragment {
  text: string;
}

/**
 * Genera embeddings para una lista de fragmentos de texto.
 * @param fragments Lista de fragmentos con texto plano.
 * @returns Lista de vectores de embedding (uno por fragmento).
 */
export async function generateEmbeddingsForFragments(fragments: TextFragment[]): Promise<number[][]> {
  return Promise.all(fragments.map(frag => generateEmbeddings(frag.text)));
}
