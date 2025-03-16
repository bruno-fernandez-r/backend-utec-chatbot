# 🧠 Chatbot con Pinecone, OpenAI y AWS S3
Un chatbot inteligente que busca respuestas en documentos PDF almacenados en AWS S3 y utiliza Pinecone para búsquedas vectoriales._
---

## 🚀 Características
- 📂 **Carga de PDFs en AWS S3**
- 🔍 **Vectorización con OpenAI Embeddings**
- 📚 **Búsqueda eficiente con Pinecone**
- 🤖 **Respuestas generadas por GPT-4o**
- ⚡ **Optimizado para consultas rápidas**

---

## 🛠️ Tecnologías utilizadas

| Tecnología | Descripción |
|------------|------------|
| **Node.js** | Entorno de ejecución de JavaScript |
| **TypeScript** | Tipado estático para JS |
| **OpenAI API** | Generación de embeddings y respuestas |
| **Pinecone** | Base de datos vectorial para búsquedas semánticas |
| **AWS S3** | Almacenamiento en la nube de los PDFs |
| **GitHub** | Control de versiones y respaldo |

---

## 📥 Instalación

### **1️⃣ Clonar el repositorio**
```bash
git clone https://github.com/bruno-fernandez-r/utec-chatbot-aws.git
cd chatbot-pinecone
```

### **2️⃣ Instalar dependencias**
```bash
npm install
```

### **3️⃣ Configurar variables de entorno**
Crea un archivo `.env` en la raíz del proyecto y coloca lo siguiente:
```plaintext
OPENAI_API_KEY=tu_clave_de_openai
PINECONE_API_KEY=tu_clave_de_pinecone
PINECONE_INDEX=my-data-pinecone
AWS_REGION=us-east-2
AWS_S3_BUCKET=myinfoinaws
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

> 📌 **Recuerda reemplazar los valores con tus claves reales.**

### **4️⃣ Ejecutar el proyecto**
```bash
ts-node src/index.ts
```

---

## 🛠️ Uso del chatbot

1️⃣ **Carga un PDF en la carpeta `documentos/`**
2️⃣ **Ejecuta el bot** (`ts-node src/index.ts`)
3️⃣ **El bot extrae el texto, lo indexa y responde consultas**

---

## 🎯 Ejemplo de Pregunta

```plaintext
🗣️ Usuario: ¿Cuáles son las carreras que ofrece UTEC?
🤖 Chatbot: UTEC ofrece varias carreras, entre ellas Ingeniería en Energías Renovables y Data Science.
```

---

## 🔥 Mejoras futuras
- [ ] Agregar interfaz web con Angular
- [ ] Mejorar respuestas con RAG (Retrieval-Augmented Generation)
- [ ] Implementar autenticación de usuarios

---

## 📜 Licencia
Este proyecto está bajo la Licencia MIT. Puedes usarlo y modificarlo libremente. 🎉

📌 **Creado por**: [Bruno Fernández] (https://github.com/bruno-fernandez-r) 🚀

