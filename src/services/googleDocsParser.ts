import { google, docs_v1 } from "googleapis";

/**
 * Extrae el texto estructurado de un documento de Google Docs.
 * Incluye encabezados, párrafos y tablas en orden.
 */
export async function parseGoogleDoc(fileId: string): Promise<string> {
  // Cargar las credenciales desde variable de entorno en base64
  const base64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!base64) throw new Error("No se encontró GOOGLE_CREDENTIALS_BASE64 en las variables de entorno.");

  const decoded = Buffer.from(base64, "base64").toString("utf8");
  const credentials = JSON.parse(decoded);

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/documents.readonly"],
  });

  await auth.authorize(); // esencial para inicializar el cliente JWT

  const docs = google.docs({ version: "v1", auth });

  try {
    const res = await docs.documents.get({ documentId: fileId });
    const content = res.data.body?.content;

    if (!content) throw new Error("El documento está vacío o sin contenido visible.");

    const fragments: string[] = [];

    for (const element of content) {
      const para = element.paragraph;
      const table = element.table;

      if (para) {
        const text = extractTextFromParagraph(para);
        if (text) fragments.push(text);
      }

      if (table) {
        const tableText = extractTextFromTable(table);
        if (tableText) fragments.push(tableText);
      }
    }

    return fragments.join("\n\n").trim();
  } catch (error) {
    console.error("❌ Error al leer el documento de Google Docs:", error);
    throw new Error("No se pudo procesar el documento de Google Docs.");
  }
}

function extractTextFromParagraph(paragraph: docs_v1.Schema$Paragraph): string {
  const text = paragraph.elements
    ?.map(el => el.textRun?.content || "")
    .join("")
    .trim();

  const style = paragraph.paragraphStyle?.namedStyleType;

  if (!text) return "";

  if (style === "HEADING_1") return `# ${text}`;
  if (style === "HEADING_2") return `## ${text}`;
  if (style === "HEADING_3") return `### ${text}`;

  return text;
}

function extractTextFromTable(table: docs_v1.Schema$Table): string {
  const output: string[] = [];

  table.tableRows?.forEach((row) => {
    const rowText = row.tableCells
      ?.map((cell) =>
        cell.content
          ?.map(c => extractTextFromParagraph(c.paragraph!))
          .join(" ")
          .trim()
      )
      .join(" | ");

    if (rowText) output.push(rowText);
  });

  return output.length ? `📋 Tabla:\n${output.join("\n")}` : "";
}
