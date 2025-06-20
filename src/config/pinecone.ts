import { Pinecone } from "@pinecone-database/pinecone";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.PINECONE_API_KEY) {
  throw new Error("Falta la variable PINECONE_API_KEY");
}

// SDK clásico: no se le pasa `environment`
export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

