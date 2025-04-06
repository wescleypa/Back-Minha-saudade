const { Type } = require('@google/genai');

const getTrain = {
  name: 'get_train',
  description: 'Obter mais exemplos de treinamento',
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: {
        type: Type.NUMBER,
        description: 'Máximo de treinamentos na consulta.',
      },
      type: {
        type: Type.NUMBER,
        description: 'Tipo de treinamento (1 - respostas boas, 2 - respostas ruins) (não retorne para obter tudo.)',
      },
    },
    required: ['limit'],
  },
};

const ignoreMessage = {
  name: 'ignore_message',
  description: `
  Não responder mensagem do usuário.
  Quando utilizar ?
  Sempre que achar que é um contexto finalizado.
  Exemplo:
  - Despedida ("tchau", "adeus", etc...)\
  - Ofensas ou mensagens sem relação
  Se for despedida, retorne apenas se no contexto já tiver despedida da assistant também.
  `
}


module.exports = {
  getTrain,
  ignoreMessage
};