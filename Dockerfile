# Usar una imagen base de Node.js
FROM node:latest

# Instalar dependencias del sistema necesarias para Puppeteer (Chromium).
# Estas librerías son esenciales para que el navegador funcione en un entorno sin GUI.
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator1 \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libgconf-2-4 \
    libgbm-dev \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    libxkbcommon0 \
    # Eliminar archivos temporales para reducir el tamaño de la imagen final
    && rm -rf /var/lib/apt/lists/*

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar los archivos del proyecto al contenedor
COPY . .

# Instalar las dependencias del proyecto de Node.js (incluyendo whatsapp-web.js, nsfwjs, etc.)
RUN npm install

# Comando para ejecutar la aplicación
CMD ["node", "index.js"]