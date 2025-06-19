import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import dotenv from 'dotenv';

dotenv.config();

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY!;
const containerName = process.env.AZURE_CONTAINER_NAME!;
const trackingFile = 'documentTracking.json';

const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
const blobServiceClient = new BlobServiceClient(
  `https://${accountName}.blob.core.windows.net`,
  sharedKeyCredential
);

export class AzureBlobService {
  private static getContainerClient() {
    return blobServiceClient.getContainerClient(containerName);
  }

  /**
   * 📤 Sube el archivo documentTracking.json a Azure Blob Storage.
   * Si ya existe, se sobreescribe automáticamente.
   */
  static async uploadTrackingJson(content: string | Buffer): Promise<void> {
    const containerClient = this.getContainerClient();
    await containerClient.createIfNotExists();

    const blockBlobClient = containerClient.getBlockBlobClient(trackingFile);
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

    await blockBlobClient.uploadData(buffer);
    console.log(`📤 documentTracking.json actualizado en Azure Blob`);
  }

  /**
   * 📥 Descarga el archivo documentTracking.json desde Azure Blob Storage.
   */
  static async downloadTrackingJson(): Promise<Buffer> {
    const containerClient = this.getContainerClient();
    const blobClient = containerClient.getBlobClient(trackingFile);

    if (!(await blobClient.exists())) {
      throw new Error("El archivo 'documentTracking.json' no existe en Azure Blob Storage.");
    }

    const downloadResponse = await blobClient.download();
    const chunks: Buffer[] = [];

    for await (const chunk of downloadResponse.readableStreamBody!) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }
}

