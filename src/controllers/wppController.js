const wppconnect = require('@wppconnect-team/wppconnect');
const { GoogleGenAI } = require('@google/genai');
const { verifyCodeFunction, transferWescley, getUserDetails, updateUserDetails, analyseFunctions } = require('../utils/functions.app');
const ai = new GoogleGenAI({
  apiKey: process.env.AI_KEY_WPP || "MY KEY"
});
let io;
let wescley = [];

class WPP {

  static addWescley = (number) => {
    return wescley.push(number);
  };

  static start = async () => {
    await wppconnect
      .create()
      .then((client) => this.startClient(client))
      .catch((error) => console.log(error));
  };

  static startClient = async (client) => {
    const instruct = `
      Você é Camila, atendente humana do suporte da plataforma Minha Saudade. 🌟  
Seu objetivo é ajudar usuários com dúvidas e suporte técnico, sempre de forma calorosa e empática (use emojis quando natural!).  

**Regras críticas:**  
1. **Confirmação de propriedade da conta:**  
   - Sempre use a função 'get_user_details' para validar dados *antes* de uma atualização, a menos que já tenha verificado!.  
   - **NUNCA** revele informações do perfil (ex: "O sistema diz que seu nome é José...").  
   - Se o usuário errar um dado (ex: nome, telefone), diga algo como:  
     *"Hmm, não consegui confirmar aqui. Poderia verificar e tentar novamente? 😊"*  
     → **Proibido:** Frases como "quase lá", "o cadastro diz X" ou qualquer vazamento de dados.  

2. **Funções disponíveis:**  
   - 'verify_code_number': Valida códigos de confirmação por telefone.  
   - 'get_user_details': Consulta dados do usuário *sem revelá-los* (só confirme internamente).  
   - 'update_user_details': Atualiza o perfil **após** confirmação de propriedade.  

3. **Fora do escopo:**  
   - Ignore assuntos não relacionados à plataforma, mas sempre confira se a dúvida é válida antes.  

**Exemplo de fluxo seguro:**  
Usuário: "Quero atualizar meu telefone."  
Camila: "Claro! Para sua segurança, qual seu nome completo cadastrado? 💛"  
*(Usa 'get_user_details' internamente e compara respostas)*  
→ Se coincidir: "Ótimo! Confirme outras informaçoes se voce achar necessário ou não."  
→ Se errar: "Verifique os dados e tente de novo, por favor! 😊"  
      `;

    const chat = ai.chats.create({
      model: "gemini-2.0-flash",
      config: {
        systemInstruction: instruct,
        maxOutputTokens: 150,
        temperature: 0.7,
        tools: [{
          functionDeclarations: [verifyCodeFunction, transferWescley, getUserDetails, updateUserDetails]
        }],
        toolConfig: {
          functionCallingConfig: {
            mode: 'AUTO'
          }
        }
      }
    });


    await client.onMessage(async (message) => {
      console.log(message?.body, message?.from);

      if (message?.from === '5519995922053@c.us') {
        if (!this.wescley?.includes(message?.from)) {
          const response = await chat.sendMessage({ message: message?.body });

          if (!response) {
            throw new Error('No response from chat service');
          }

          if (response.functionCalls?.length > 0) {
            const result = await analyseFunctions(io, response.functionCalls, message.from);

            if (!!result?.name) {
              const finalResponse = await chat.sendMessage({
                message: {
                  functionResponse: { name: result?.name, response: result }
                }
              });

              await client.sendText(message.from, finalResponse?.text);
            } else {
              await client.sendText('Desculpa houve um erro ao tentar processar sua solicitação.');
              await client.sendText('Você pode tentar enviar outra mensagem para analisarmos novamente...');
            }
          } else {
            await client.sendText(message.from, response?.text);
          }
        } else {
          if (message?.body?.toString()?.toUpperCase() === 'FINALIZAR ATENDIMENTO') {
            const index = array.indexOf(message?.from);
            if (index !== -1) {
              array.splice(index, 1);
            }
          }
        }
      }
    });

  };

  static SetIO(socketIO) {
    io = socketIO;
  }
};

module.exports = WPP;