# 🤖 Chatbot con Pinecone, OpenAI y Google Drive

Un chatbot desarrollado para la **Universidad Tecnológica - UTEC**, que permite procesar documentos de Google Drive, vectorizarlos con OpenAI y realizar búsquedas semánticas eficientes con Pinecone.
Incluye soporte para múltiples chatbots independientes, historial de conversación, control de versiones de documentos y configuración de comportamiento vía prompt.

---

## 🚀 Características

* 📄 Procesamiento de documentos `.gdoc` y `.gsheet` desde Google Drive
* 🔍 Vectorización con OpenAI Embeddings
* 🧠 Búsqueda semántica eficiente con Pinecone
* 🔁 Control de versiones con `documentTracking.json`
* 🧹 Limpieza automática de vectores no utilizados
* 🧠 Prompt de comportamiento personalizado por chatbot
* 💬 Historial de conversación por sesión
* 📥 Entrenamiento automatizado por documento
* 📃 Listado de archivos por chatbot
* ❌ Endpoint para olvidar documento por bot
* 🔒 Acceso controlado a archivos
* 🧪 Endpoints validados vía Postman

---

## 🛠️ Tecnologías utilizadas

| Tecnología           | Descripción                                    |
| -------------------- | ---------------------------------------------- |
| **Node.js**          | Entorno de ejecución JavaScript                |
| **TypeScript**       | Tipado estático para mayor robustez            |
| **OpenAI API**       | Embeddings y generación de respuestas          |
| **Pinecone**         | Base de datos vectorial (búsquedas semánticas) |
| **Google Drive API** | Acceso a documentos `.gdoc` y `.gsheet`        |
| **Azure Blob**       | (Sólo para control de versiones)               |
| **Azure Table**      | Metadatos de configuración por chatbot         |
| **Express**          | API REST backend                               |
| **Postman**          | Pruebas de API REST                            |

---

## 📥 Instalación

### 1️⃣ Clonar el repositorio

```bash
git clone https://github.com/bruno-fernandez-r/utec-chatbot-aws.git
cd Proyecto\ ChatBot
```

### 2️⃣ Instalar dependencias

```bash
npm install
```

Si tenés errores, corré:

```bash
npm install express dotenv gpt-3-encoder @pinecone-database/pinecone uuid googleapis
npm install --save-dev ts-node @types/express @types/node
```

---

## ⚙️ Configuración `.env`

```env
# 🔐 OpenAI
OPENAI_API_KEY=sk-XXXXXXXXXXXXXXXXXXXXXXXX
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# 📦 Pinecone
PINECONE_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX=nombre-del-indice

# 📄 Google
GOOGLE_CREDENTIALS_BASE64=  # Base64 del JSON de credenciales
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@developer.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nXXX\n-----END PRIVATE KEY-----\n"
AZURE_CONTAINER_CONTROL=control-documentos
```

> 🔒 Nunca publiques este archivo.

---

### 3️⃣ Ejecutar el servidor

```bash
ts-node src/server.ts
```

---

## 📡 Endpoints principales

### 🔄 Entrenar chatbot (Google Drive)

```
POST /drive-train/google-drive
```

Body JSON:

```json
{
  "documentId": "ID_DEL_DOCUMENTO",
  "chatbotId": "ID_DEL_CHATBOT"
}
```

---

### 🧾 Ver documentos entrenados

```
GET /train/:chatbotId/documents
```

---

### ❌ Olvidar documento por bot

```
DELETE /train/forget/:chatbotId/:documentId
```

---

### ✍️ Editar prompt del chatbot

```
PUT /chatbots/:id/prompt
```

Body JSON:

```json
{ "prompt": "Texto de comportamiento..." }
```

---

### 💬 Consultar al chatbot

```
POST /chat
```

Body JSON:

```json
{
  "query": "¿Qué es UTEC?",
  "chatbotId": "123",
  "sessionId": "abc"
}
```

---

## 📊 Control y versión de documentos

Todos los documentos entrenados desde Google Drive se registran en un archivo `documentTracking.json` almacenado en Azure Blob Storage. Este archivo mantiene:

* `documentId`: identificador técnico único
* `name`: nombre visible del documento
* `mimeType`: tipo MIME (`application/vnd.google-apps.document`, etc.)
* `usedByBots`: lista de `chatbotId` que lo utilizan
* `trainedAt`: timestamp de la última vez que fue entrenado

Si un bot entrena una versión más antigua, se actualiza automáticamente. Si un documento ya no es usado por ningún bot, se eliminan sus vectores.

---

## 🎯 Ejemplo de Pregunta

```text
🗣️ Usuario: ¿Cuál es el contacto de soporte técnico para la plataforma EDU?
🤖 Chatbot: El contacto es entorno.virtual@utec.edu.uy
```

---

## 🔥 Mejoras futuras

* [ ] Interfaz web para gestión de chatbots
* [ ] Panel de actividad e historial de consultas
* [ ] Soporte para archivos DOCX / TXT
* [ ] Roles y autenticación

---

## 📜 Licencia

Este proyecto es propiedad de la **Universidad Tecnológica del Uruguay (UTEC)**.
Su uso está restringido exclusivamente a fines institucionales.
❗ **No está permitido reutilizar este código fuera de los fines autorizados por UTEC.**

📌 **Desarrollado por**: Bruno Fernández
🔗 [github.com/bruno-fernandez-r](https://github.com/bruno-fernandez-r)
