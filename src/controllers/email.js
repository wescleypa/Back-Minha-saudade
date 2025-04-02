const otpTemplate = require('../emails/otp');
const transporter = require('../config/smtp');

class Email {
  static createAccount = async (code, email) => {
    const mailOptions = {
      from: `"Minha saudade" <contato@souwescley.com>`,
      to: email,
      subject: "Confirmação de cadastro - Minha saudade",
      html: otpTemplate(code),
      text: `Para confirmar sua conta, digite o código: ${code}`
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (info) {
      console.log('email enviado...');
    }
    return info;
  };
};

module.exports = Email;