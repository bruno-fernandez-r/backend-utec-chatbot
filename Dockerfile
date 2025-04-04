
# Usa una imagen base ligera con Node.js
FROM node:18-alpine

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia archivos necesarios para instalar dependencias
COPY package*.json tsconfig.json ./

# Instala las dependencias del proyecto
RUN npm install

# Copia el resto del código fuente
COPY . .

# Expone el puerto donde corre tu app
EXPOSE 3000

# Comando para ejecutar el servidor con ts-node
CMD ["npx", "ts-node", "src/server.ts"]
