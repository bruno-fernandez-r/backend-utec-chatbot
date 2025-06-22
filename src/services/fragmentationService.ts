/**
 * Servicio: fragmentationService.ts
 * ----------------------------------
 * Fragmenta un texto largo en bloques de máximo N tokens, optimizado para embeddings.
 * Respeta encabezados jerárquicos (H1-H4) y no corta oraciones a la mitad.
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
 * Fragmenta texto estructurado en secciones por encabezados y tokens.
 * @param content Texto plano con encabezados tipo Markdown (#, ##, etc.)
 * @param maxTokens Máximo de tokens por fragmento (por defecto: 250)
 * @returns Lista de fragmentos listos para vectorizar
 */
export function splitTextIntoFragments(content: string, maxTokens: number = 250): Fragment[] {
  const encoder = encoding_for_model("text-embedding-3-small");

  const lines = content.split("\n");
  const fragments: Fragment[] = [];

  const hierarchy: string[] = [];
  let currentContent: string[] = [];

  function buildTitle(): string {
    return hierarchy.filter(Boolean).join(" > ");
  }

  function flushFragment() {
    const fullText = currentContent.join("\n").trim();
    if (fullText.length === 0) return;

    const tokenCount = encoder.encode(fullText).length;

    if (tokenCount <= maxTokens) {
      fragments.push({ title: buildTitle(), text: fullText });
    } else {
      fragments.push(...splitByTokenLimit(fullText, buildTitle(), encoder, maxTokens));
    }

    currentContent = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    const headingMatch = /^(#{1,4})\s+(.*)/.exec(trimmed);
    if (headingMatch) {
      flushFragment();
      const level = headingMatch[1].length;
      const titleText = headingMatch[2].trim();

      hierarchy.length = level - 1; // corta la jerarquía si bajamos de nivel
      hierarchy[level - 1] = titleText;
      continue;
    }

    currentContent.push(trimmed);
  }

  flushFragment(); // último fragmento
  encoder.free();
  return fragments;
}

/**
 * Subdivide un bloque largo respetando oraciones y límite de tokens.
 */
function splitByTokenLimit(text: string, title: string, encoder: ReturnType<typeof encoding_for_model>, maxTokens: number): Fragment[] {
  const sentences = text.split(/(?<=[.?!])\s+/); // separa por puntuación
  const parts: Fragment[] = [];
  let buffer = "";

  for (const sentence of sentences) {
    const tentative = buffer.length > 0 ? buffer + " " + sentence : sentence;
    const tokenCount = encoder.encode(tentative).length;

    if (tokenCount <= maxTokens) {
      buffer = tentative;
    } else {
      if (buffer.trim().length > 0) {
        parts.push({ title, text: buffer.trim() });
      }
      buffer = sentence;
    }
  }

  if (buffer.trim().length > 0) {
    parts.push({ title, text: buffer.trim() });
  }

  return parts;
}
