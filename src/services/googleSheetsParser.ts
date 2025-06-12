import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";

/**
 * Extrae el contenido de una hoja de cálculo de Google (formato .gsheet)
 * en formato de texto plano, separando celdas por "|", incluyendo título de hoja.
 * @param fileId ID del archivo en Google Drive
 * @returns Texto plano representando la hoja de cálculo
 */
export async function parseGoogleSheet(fileId: string): Promise<string> {
  const base64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!base64) throw new Error("La variable de entorno GOOGLE_CREDENTIALS_BASE64 no está definida.");

  const credentials = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  await auth.authorize();

  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.get({
    spreadsheetId: fileId,
    includeGridData: true,
  });

  const result: string[] = [];

  response.data.sheets?.forEach((sheet) => {
    const title = sheet.properties?.title || "Sin título";
    result.push(`📊 Hoja: ${title}\n`);

    sheet.data?.forEach((grid) => {
      grid.rowData?.forEach((row) => {
        const rowText = row.values
          ?.map((cell) => cell.formattedValue ?? "")
          .join(" | ");
        result.push(rowText || "");
      });
    });

    result.push("\n");
  });

  return result.join("\n");
}
