# Usar una imagen base de Node.js
FROM node:18

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar los archivos package.json y package-lock.json
COPY package*.json ./

# Instalar las dependencias
RUN npm install --omit=dev

# Copiar el resto de los archivos de la aplicación
COPY . .

# Exponer el puerto (si es necesario, aunque este bot no usa puertos directamente)
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD ["node", "index.js"]