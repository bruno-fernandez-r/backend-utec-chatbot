/**
 * Servicio: fragmentationService.ts
 * ----------------------------------
 * Fragmenta un texto largo en bloques de máximo N tokens, optimizado para embeddings.
 * Utiliza el tokenizador oficial de OpenAI vía '@dqbd/tiktoken' para el modelo 'text-embedding-3-small'.
 */

import { encoding_for_model } from "@dqbd/tiktoken";

/**
 * Representa un fragmento segmentado de texto.
 */
export interface Fragment {
  title: string;
  text: string;
}

/**
 * Fragmenta texto plano en bloques que no superen el máximo de tokens permitidos.
 * @param content El contenido a fragmentar.
 * @param maxTokens Máximo de tokens por fragmento (por defecto: 250).
 * @returns Lista de fragmentos listos para vectorizar.
 */
export function splitTextIntoFragments(content: string, maxTokens: number = 250): Fragment[] {
  const encoder = encoding_for_model("text-embedding-3-small");

  const paragraphs = content
    .split(/\n\s*\n/) // separa por saltos dobles de línea
    .map(p => p.trim())
    .filter(Boolean);

  const fragments: Fragment[] = [];
  let currentFragment = "";

  for (const paragraph of paragraphs) {
    const currentTokens = encoder.encode(currentFragment).length;
    const paragraphTokens = encoder.encode(paragraph).length;

    if (currentTokens + paragraphTokens <= maxTokens) {
      currentFragment += paragraph + "\n\n";
    } else {
      if (currentFragment) {
        fragments.push({ title: "Fragmento", text: currentFragment.trim() });
      }
      currentFragment = paragraph + "\n\n";
    }
  }

  if (currentFragment.trim().length > 0) {
    fragments.push({ title: "Fragmento", text: currentFragment.trim() });
  }

  encoder.free(); // liberar recursos del encoder

  return fragments;
}
