const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const tf = require('@tensorflow/tfjs'); // Usamos la versión pura (sin node)
const nsfw = require('nsfwjs');
const jpeg = require('jpeg-js'); // Nueva librería para leer las fotos
const OllamaServices = require('./ollamaServices'); // Importar el servicio de Ollama

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox'] }
});

let model;
let ollamaService; // Instancia del servicio de Ollama

// --- Función auxiliar para convertir imagen a Tensor ---
async function imageToTensor(mediaData) {
    // 1. Convertir base64 a Buffer
    const imageBuffer = Buffer.from(mediaData, 'base64');
    
    // 2. Decodificar JPEG a datos crudos (píxeles)
    // Nota: Esto asume que la foto es JPEG (la mayoría de fotos de cámara lo son)
    const rawImageData = jpeg.decode(imageBuffer, { useTArray: true });
    
    // 3. Crear el tensor 3D que necesita la IA [alto, ancho, 3 colores RGB]
    const { width, height, data } = rawImageData;
    // TensorFlow espera float32 para procesar
    const tensor = tf.browser.fromPixels({ data, width, height });
    
    return tensor;
}

async function iniciarBot() {
    console.log("Cargando cerebro de Inteligencia Artificial...");
    // Cargamos el modelo. Notar que ya no necesitamos parámetros extra aquí
    model = await nsfw.load(); 
    console.log("¡IA Cargada! Iniciando WhatsApp...");
    
    // Inicializar servicio de Ollama
    ollamaService = new OllamaServices();
    console.log("Servicio de Ollama inicializado...");
    
    client.initialize();
}

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('ESCANEA EL QR AHORA');
});

client.on('ready', () => {
    console.log('✅ Bot Guardián ACTIVO y LISTO.');
});

client.on('message', async (msg) => {
    if (msg.fromMe) return;

    if (msg.body === '!todos') {
        const chat = await msg.getChat();
        
        // Solo permitir si es grupo
        if (chat.isGroup) {
            let text = "📢 *LLAMANDO A TODOS*\n\n";
            let mentions = [];
    
            for (let participant of chat.participants) {
                mentions.push(participant.id._serialized);
                text += `@${participant.id.user} `;
            }
    
            await chat.sendMessage(text, { mentions });
        }
    }

    // Comando para responder 'pong' al mensaje '!ping'
    if (msg.body === '!ping') {
        await msg.reply('pong');
    }

    // Comando para interactuar con Ollama AI
    if (msg.body.startsWith('!gibli ')) {
        try {
            const userQuestion = msg.body.substring(7).trim(); // Remover '!gibli '
            
            if (!userQuestion) {
                await msg.reply('Por favor, incluye una pregunta después del comando !gibli');
                return;
            }

            // Mostrar mensaje de "escribiendo..."
            const chat = await msg.getChat();
            await chat.sendStateTyping();

            // Generar respuesta usando Ollama
            const response = await ollamaService.generateResponse(
                msg.from, // Usar el ID del chat como identificador
                userQuestion
            );

            // Verificar si es el mensaje de contexto superado
            if (response === '!contexto superado limpiando contexto') {
                await msg.reply('⚠️ ' + response);
                // Procesar el mensaje nuevamente después de limpiar
                const newResponse = await ollamaService.generateResponse(msg.from, userQuestion);
                await msg.reply('🤖 ' + newResponse);
            } else {
                await msg.reply('🤖 ' + response);
            }

            // Mostrar estadísticas de la conversación
            const stats = ollamaService.getConversationStats(msg.from);
            console.log(`Chat ${msg.from}: ${stats.messageCount}/${60} mensajes usados`);

        } catch (error) {
            console.error('Error procesando comando !gibli:', error);
            await msg.reply('❌ Error procesando tu pregunta. Inténtalo más tarde.');
        }
    }

    // Coloca esto dentro de client.on('message', ...)
if (msg.body === '!sticker' && msg.hasMedia) {
    try {
        const media = await msg.downloadMedia();
        // Enviar de vuelta como sticker
        await client.sendMessage(msg.from, media, { 
            sendMediaAsSticker: true,
            stickerName: 'Bot Sticker', // Nombre del paquete
            stickerAuthor: 'Tu Nombre'  // Autor
        });
    } catch (e) {
        msg.reply('Error al crear sticker.');
    }
}

    if (msg.hasMedia) {
        // 1. TOLERANCIA CERO: View Once
        if (msg.isViewOnce || (msg._data && msg._data.isViewOnce)) {
            console.log(`[PELIGRO] ViewOnce detectado de ${msg.from}`);
            try {
                await msg.delete(true);
                // ... resto del código
            } catch (e) {
                console.log("Error borrando", e);
            }
            return;
       }

        // 2. ANÁLISIS DE IMAGEN
        if (msg.type === 'image') {
            try {
                const media = await msg.downloadMedia();
                if (media) {
                    // Convertimos la imagen usando nuestra nueva función
                    const imageTensor = await imageToTensor(media.data);
                    
                    const predictions = await model.classify(imageTensor);
                    imageTensor.dispose(); // Limpiar memoria

                    // Umbrales
                    const pornProb = predictions.find(p => p.className === 'Porn').probability;
                    const hentaiProb = predictions.find(p => p.className === 'Hentai').probability;

                    console.log(`Analizando imagen... Porn: ${(pornProb*100).toFixed(1)}%`);

                    if (pornProb > 0.60 || hentaiProb > 0.60) {
                        console.log('!!! BORRANDO CONTENIDO !!!');
                        await msg.delete(true);
                        await msg.reply('⚠️ Imagen eliminada por contenido inapropiado.');
                    }
                }
            } catch (error) {
                // Si la imagen no es JPEG o falla la conversión, simplemente la ignoramos
                // console.error('No se pudo procesar la imagen (quizás es PNG o Sticker):', error.message);
            }
        }
    }
});

iniciarBot();