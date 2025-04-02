const nodemailer = require('nodemailer');

// Configurações do SMTP da Umbler
const umblerConfig = {
  host: 'smtp.umbler.com', // Host da Umbler
  port: 587, // Porta padrão para SMTP
  secure: false, // true para 465, false para outras portas
  auth: {
    user: "contato@souwescley.com", // Seu e-mail @seudominio.com
    pass: "Megsone476!" // Senha do e-mail
  },
  tls: {
    rejectUnauthorized: false // Importante para evitar problemas de certificado
  }
};

// Cria o transporter reutilizável
const transporter = nodemailer.createTransport(umblerConfig);

// Testa a conexão (opcional)
transporter.verify((error) => {
  if (error) {
    console.error('Erro na conexão SMTP:', error);
  } else {
    console.log('Servidor SMTP pronto para enviar mensagens');
  }
});

module.exports = transporter;