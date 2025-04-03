const Config = require('../config/deepseek');
const Chats = require('./chats');
const User = require('../controllers/auth');

/*const GoogleGenAI = require('@google/genai');

const User = require('../controllers/auth');
const OpenAI = require('openai');
//const ia = new OpenAI({
//  baseURL: 'https://api.deepseek.com',
//  apiKey: 'sk-212869cea46a43c39d9f3debc7f6ac65'
//});

const ai = new GoogleGenAI({ apiKey: "AIzaSyAdhgyx4wVnov3eiFHkMSKnpjT3KiaskPo" });

var chat = [];

class GoogleIA {
  static configure = (id, history) => {
    chat[id] = ai.chats.create({
      model: "gemini-2.0-flash",
      history
    });
    /*
     [
        {
          role: "user",
          parts: [{ text: "Hello" }],
        },
        {
          role: "model",
          parts: [{ text: "Great to meet you. What would you like to know?" }],
        },
      ]
        *
  };

  static send = async (chat, input, context=null, token=null) => {

    if (chat.includes(chat)) {
      //envia msg normalmente
    } else {
     // passa o history
    }
  };
}
/*
class Deepseek {
  static send = async (context, input, token = null) => {
    try {
      const { valid, payload } = await User.verifyTokenCache(token);
      const messages = [];

      if (valid && payload?.name) {
        messages.push({ role: "system", content: `O nome do usuário é: ${payload?.name}` });
      }
      messages.push(
        { role: "system", content: Config.initialMessage(context) },
        { role: "user", content: input }
      );

      const completion = await ia.chat.completions.create({
        messages,
        model: "deepseek-chat",
        temperature: 0.8,
        response_format: { type: "json_object" }
      });

      return completion.choices[0].message.content;
    } catch (err) {
      return err;
    }
  };
};*

module.exports = GoogleIA;*/


const { GoogleGenAI, Type } = require('@google/genai');

// Configuração segura (melhor usar variáveis de ambiente)
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_AI_API_KEY || "AIzaSyAdhgyx4wVnov3eiFHkMSKnpjT3KiaskPo"
});

// Objeto para armazenar conversas (em produção, use um banco de dados)
const activeChats = {};

class GoogleIA {
  /**
   * Configura um novo chat ou retorna um existente
   * @param {string} id - ID único da conversa
   * @param {Array} history - Histórico de mensagens (opcional)
   * @returns {Object} Instância do chat
   */
  static async configure(id, context = null, user = null, chat = null) {
    if (!activeChats[id]) {

      console.log('chat criado', Config.initialMessage(context, user, chat));
      activeChats[id] = ai.chats.create({
        model: "gemini-2.0-flash",
        //history: this._formatHistory(history) //histórico de importação
        config: {
          systemInstruction: Config.initialMessage(context, user, chat),
          maxOutputTokens: 300,
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              'shouldReply': {
                type: Type.BOOLEAN,
                description: 'Enviar resposta ?',
                nullable: false,
              },
              'reply': {
                type: Type.STRING,
                description: 'Sua resposta',
                nullable: false,
              },
              'reason': {
                type: Type.STRING,
                description: 'Motivo de não enviar a resposta',
                nullable: true,
              },
              'name': {
                type: Type.STRING,
                description: "Se identificar o nome da 'saudade' do usuário, retorne o nome para salvar no bd, mas retorne apenas na msg atual, assim evita retornar toda hora.",
                nullable: true
              }
            },
            required: ['shouldReply', 'reply'],

          },
        }
      });
    }

    return activeChats[id];
  }


  /**
   * Envia uma mensagem para o chat
   * @param {string} chatId - ID da conversa
   * @param {string} input - Mensagem do usuário
   * @param {string|null} context - Contexto adicional (opcional)
   * @param {string|null} token - Token de autenticação (opcional)
   * @returns {Promise<string>} Resposta do AI
   */
  static async send(chatId, input, context = null, token = null, mychat = null) {
    try {
      const { valid, payload } = await User.verifyTokenCache(token);
      var userName = null;

      if (valid) userName = payload?.name;

      const chat = await this.configure(chatId, context, userName, mychat);

      // Envia a mensagem do usuário
      const result = await chat.sendMessage({ message: input });
      const parsedResponse = JSON.parse(result?.text);

      if (parsedResponse?.name && parsedResponse?.name?.length > 1 && valid) {
        await Chats.rename(
          payload?.id,
          chatId,
          parsedResponse?.name,
          null
        );
      }

      return result.text;
    } catch (err) {
      console.error("Erro no GoogleIA:", err);
      throw new Error("Falha ao processar sua solicitação");
    }
  }

  static async sendEmpty(userSocket, input, context = []) {
    try {
      const chat = await this.configure(userSocket, context);

      // Envia a mensagem do usuário
      const result = await chat.sendMessage({ message: input });
      const parsedResponse = JSON.parse(result?.text);

      console.log(result?.text);
      return result.text;
    } catch (err) {
      console.error("Erro no GoogleIA:", err);
      throw new Error("Falha ao processar sua solicitação");
    }
  }

  /**
   * Formata o histórico de mensagens para o formato do Gemini
   * @private
   */
  static _formatHistory(history) {
    return history.map(msg => ({
      role: msg?.sender === "user" ? "user" : "model",
      parts: [{ text: msg?.text ?? 'Mensagem não encontrada.' }]
    }));
  }

  /**
   * Limpa um chat específico
   */
  static async clearChat(chatId) {
    try {
      console.log('chamou ', chatId)
      delete activeChats[chatId];
      return true;
    } catch (err) {
      console.log('deu erro');
      console.error(err);
      throw err;
    }
  }
}

module.exports = GoogleIA;