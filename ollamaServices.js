const axios = require('axios');

class OllamaServices {
    constructor() {
        this.host = process.env.OLLAMA_HOST || 'localhost';
        this.port = process.env.OLLAMA_PORT || '11434';
        this.baseUrl = `http://${this.host}:${this.port}`;
        
        // Almacenar conversaciones por chat ID
        this.conversations = new Map();
        
        // Límite de mensajes por conversación
        this.messageLimit = 60;
        
        // Modelo por defecto
        this.defaultModel = 'llama3.2';
    }

    /**
     * Inicializar una nueva conversación para un chat
     * @param {string} chatId - ID del chat
     */
    initializeConversation(chatId) {
        this.conversations.set(chatId, {
            messages: [],
            messageCount: 0
        });
    }

    /**
     * Verificar si existe una conversación para un chat
     * @param {string} chatId - ID del chat
     * @returns {boolean}
     */
    hasConversation(chatId) {
        return this.conversations.has(chatId);
    }

    /**
     * Verificar si el límite de mensajes ha sido alcanzado
     * @param {string} chatId - ID del chat
     * @returns {boolean}
     */
    isLimitReached(chatId) {
        if (!this.hasConversation(chatId)) return false;
        
        const conversation = this.conversations.get(chatId);
        return conversation.messageCount >= this.messageLimit;
    }

    /**
     * Limpiar el contexto de una conversación
     * @param {string} chatId - ID del chat
     */
    clearContext(chatId) {
        this.conversations.set(chatId, {
            messages: [],
            messageCount: 0
        });
        console.log(`Contexto limpiado para chat: ${chatId}`);
    }

    /**
     * Agregar mensaje a la conversación
     * @param {string} chatId - ID del chat
     * @param {string} role - 'user' o 'assistant'
     * @param {string} content - Contenido del mensaje
     */
    addMessage(chatId, role, content) {
        if (!this.hasConversation(chatId)) {
            this.initializeConversation(chatId);
        }

        const conversation = this.conversations.get(chatId);
        conversation.messages.push({
            role: role,
            content: content
        });
        
        if (role === 'user') {
            conversation.messageCount++;
        }
    }

    /**
     * Verificar si Ollama está disponible
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`, {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            console.error('Ollama no está disponible:', error.message);
            return false;
        }
    }

    /**
     * Descargar un modelo si no existe
     * @param {string} model - Nombre del modelo
     * @returns {Promise<boolean>}
     */
    async ensureModel(model = this.defaultModel) {
        try {
            // Verificar si el modelo existe
            const response = await axios.get(`${this.baseUrl}/api/tags`);
            const models = response.data.models || [];
            
            const modelExists = models.some(m => m.name.includes(model));
            
            if (!modelExists) {
                console.log(`Descargando modelo ${model}...`);
                await axios.post(`${this.baseUrl}/api/pull`, {
                    name: model
                }, {
                    timeout: 300000 // 5 minutos para descargar
                });
                console.log(`Modelo ${model} descargado exitosamente`);
            }
            
            return true;
        } catch (error) {
            console.error(`Error descargando modelo ${model}:`, error.message);
            return false;
        }
    }

    /**
     * Generar respuesta usando Ollama
     * @param {string} chatId - ID del chat
     * @param {string} userMessage - Mensaje del usuario
     * @param {string} model - Modelo a usar
     * @returns {Promise<string>}
     */
    async generateResponse(chatId, userMessage, model = this.defaultModel) {
        try {
            // Verificar si Ollama está disponible
            if (!await this.isAvailable()) {
                throw new Error('Servicio de IA no disponible');
            }

            // Asegurar que el modelo esté disponible
            await this.ensureModel(model);

            // Verificar límite de mensajes
            if (this.isLimitReached(chatId)) {
                this.clearContext(chatId);
                return '!contexto superado limpiando contexto';
            }

            // Agregar mensaje del usuario
            this.addMessage(chatId, 'user', userMessage);
            
            // Obtener conversación actual
            const conversation = this.conversations.get(chatId);
            
            // Preparar el prompt con contexto
            const messages = conversation.messages;
            
            // Crear el contexto para la API
            let prompt = '';
            messages.forEach(msg => {
                if (msg.role === 'user') {
                    prompt += `Usuario: ${msg.content}\n`;
                } else {
                    prompt += `Asistente: ${msg.content}\n`;
                }
            });

            // Hacer la petición a Ollama
            const response = await axios.post(`${this.baseUrl}/api/generate`, {
                model: model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    max_tokens: 500
                }
            }, {
                timeout: 30000 // 30 segundos
            });

            const aiResponse = response.data.response;

            // Agregar respuesta del asistente
            this.addMessage(chatId, 'assistant', aiResponse);

            return aiResponse;

        } catch (error) {
            console.error('Error generando respuesta:', error.message);
            
            if (error.code === 'ECONNREFUSED') {
                return 'Error: No se puede conectar con el servicio de IA. Inténtalo más tarde.';
            } else if (error.code === 'ETIMEDOUT') {
                return 'Error: El servicio de IA tardó demasiado en responder. Inténtalo más tarde.';
            } else {
                return 'Error: Hubo un problema procesando tu mensaje. Inténtalo nuevamente.';
            }
        }
    }

    /**
     * Obtener estadísticas de una conversación
     * @param {string} chatId - ID del chat
     * @returns {Object}
     */
    getConversationStats(chatId) {
        if (!this.hasConversation(chatId)) {
            return {
                messageCount: 0,
                messagesRemaining: this.messageLimit,
                totalMessages: 0
            };
        }

        const conversation = this.conversations.get(chatId);
        return {
            messageCount: conversation.messageCount,
            messagesRemaining: this.messageLimit - conversation.messageCount,
            totalMessages: conversation.messages.length
        };
    }
}

module.exports = OllamaServices;