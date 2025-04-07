const { Type } = require('@google/genai');
const UserService = require('../services/user.service');
const WPP = require('../controllers/wppController');

const verifyCodeFunction = {
  name: 'verify_code_number',
  description: 'Verifica um código de confirmação de telefone, e autoriza a atualização de 2 favores caso esteja correto.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      code: {
        type: Type.NUMBER,
        description: 'Código de verificação informado.',
      }
    },
    required: ['code'],
  },
};

/*const messageSeq = {
  name: 'message_sequence',
  description: 'Caso ache melhor, você pode enviar uma mensagem em sequência (exemplo: msg:1 oi, msg2: como está ?)',
  parameters: {
    type: Type.OBJECT,
    properties: {
      message: {
        type: Type.STRING,
        description: 'Mensagem',
      }
    },
  },
};*/

const getUserDetails = {
  name: 'get_user_details',
  description: `
  \nObtém detalhes do usuário
  \n(usado para cosultas, entender erros, informações, etc)
  \ninformações disponíveis para confirmação de propriedade: (nome cadastrado, telefone cadastrado, telefone verificado ?, data de criação)
  \ninformações que você não deve consultar: (senha)
  \nCHAME ESSA FUNÇÃO SEMPRE QUE PRECISAR CONFIRMAR A PROPRIEDADE DA CONTA!
  \nEx: 'quero alterar algo', ...
  `,
  parameters: {
    type: Type.OBJECT,
    properties: {
      email: {
        type: Type.STRING,
        description: 'E-mail formatado',
      }
    },
    required: ['email'],
  },
};

const updateUserDetails = {
  name: 'update_user_details',
  description: `
  \nAtualiza informações do usuário após confirmar propriedade.
  \ninformações que você pode alterar: (biografia do perfil, verificar telefone, Notificação por app ?, Notificação por email ?, Habilitar 2 fatores)
  \nCHAME ESSA FUNÇÃO SEMPRE QUE VOCE QUISER ALTERAR UM DOS CAMPOS ACIMA, desde que voce tenha confirmado a propriedade da conta pertence ao usuário!
  `,
  parameters: {
    type: Type.OBJECT,
    properties: {
      column: {
        type: Type.STRING,
        enum: ['bio', 'phone_verified', 'notification_app', 'notification_email', 'two_factor_enabled'],
        description: 'Nome da coluna à ser alterada',
      },
      value: {
        type: Type.STRING,
        description: 'Valor à ser definido',
      }
    },
    required: ['column', 'value'],
  },
};

const transferWescley = {
  name: 'transfer_wescley',
  description: 'Este também pode ser um número pessoal, por tanto, se notar ou pedirem, use essa função para transferir a conversa à mim (Wescley). *Qualquer pessoa que explicitamente  falar meu nome (Wescley), você pode transferir a conversa automaticamente.*',
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: {
        type: Type.STRING,
        description: 'Motivo da transferência',
      }
    },
  },
};

function formatBrazilianPhone(whatsappId) {
  // Remove tudo que não é dígito
  const digits = whatsappId.replace(/\D/g, '');

  // Extrai os dígitos relevantes (DDD + número)
  const ddd = digits.substring(2, 4);
  const prefix = digits.substring(4, 9);
  const suffix = digits.substring(9, 13);

  return `(${ddd}) ${prefix}-${suffix}`;
}

const analyseFunctions = async (io = null, functions, number) => {
  if (!functions?.length) return { success: false, message: 'No functions to analyse' };

  try {
    for (const func of functions || {}) {
      switch (func.name) {
        case 'verify_code_number': {
          if (!func?.args?.code) {
            return { success: false, name: func?.name, message: 'Verification code missing' };
          }
          const data = await UserService.verifyCode.confirm(func?.args?.code, 2, formatBrazilianPhone(number));
          if (data?.success) {
            if (io) {
              await io.to(data?.userID).emit('phone:verified', {});
              delete data.userID;
            }
          }
          return Object.assign({ data, name: func?.name });
        };

        case 'get_user_details': {
          if (!func?.args?.email) {
            return { success: false, name: func?.name, message: 'Email missing' };
          }

          const userData = await UserService.get.user.byEmail(func?.args?.email);
          console.log(userData);
          if (userData && userData?.length) {
            return { success: true, name: func?.name, data: userData }
          } else {
            return { success: false, name: func?.name, message: 'Email invalid' };
          }
        }

        case 'update_user_details': {
            console.log(func)
        }

        case 'transfer_wescley': {
          WPP.addWescley(number);
          return { success: true, name: func?.name, message: 'Conversa transferida com sucesso.' };
        }
        // Adicione outros casos aqui
      }
    }
    return { success: false, name: null, message: 'No matching function calls found' };
  } catch (error) {
    console.error('Analysis error:', error);
    return { success: false, message: error.message || 'Function analysis failed' };
  }
};

module.exports = {
  verifyCodeFunction,
  transferWescley,
  //messageSeq,
  getUserDetails,
  updateUserDetails,
  analyseFunctions
};