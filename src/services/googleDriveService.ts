// src/services/googleDriveService.ts

import { google, drive_v3 } from "googleapis";
import * as dotenv from "dotenv";
dotenv.config();

// ✅ Validar variables de entorno requeridas
if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
  throw new Error("❌ Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY en el archivo .env");
}

// ✅ Autenticación moderna con JWT
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

// ✅ Autenticarse explícitamente (opcional pero recomendado para detectar errores temprano)
auth.authorize().catch((error) => {
  console.error("❌ Error al autorizar con Google JWT:", error);
  throw new Error("Error de autenticación con Google JWT.");
});

// ✅ Instanciar el cliente de Google Drive
const drive = google.drive({ version: "v3", auth });

/**
 * Lista los archivos visibles dentro de una carpeta de Google Drive.
 * @param folderId ID de la carpeta
 * @returns Array de archivos con nombre, ID y tipo MIME
 */
export async function listFilesInFolder(
  folderId: string
): Promise<{ name: string; documentId: string; mimeType: string }[]> {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType)",
    });

    const files = response.data.files || [];

    return files.map((file: drive_v3.Schema$File) => ({
      name: file.name || "Sin nombre",
      documentId: file.id || "Sin ID",
      mimeType: file.mimeType || "Desconocido",
    }));
  } catch (error) {
    console.error("❌ Error al listar archivos en Google Drive:", error);
    throw new Error("Error al obtener los archivos de la carpeta de Google Drive.");
  }
}
