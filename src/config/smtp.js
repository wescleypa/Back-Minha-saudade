require('dotenv').config();
const nodemailer = require('nodemailer');

const getEnvBool = (val) => val === 'true';


// Configurações do SMTP
const config = {
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: getEnvBool(process.env.MAIL_SECURE),
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  },
  tls: {
    rejectUnauthorized: getEnvBool(process.env.MAIL_SECURE)
  }
};

// Cria o transporter reutilizável
const transporter = nodemailer.createTransport(config);

// Testa a conexão
transporter.verify((error) => {
  if (error) {
    console.error('Erro na conexão SMTP:', error);
    console.log(config);
  } else {
    console.log('Servidor SMTP pronto para enviar mensagens');
  }
});

module.exports = transporter;