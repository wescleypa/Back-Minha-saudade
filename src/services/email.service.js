const otpTemplate = require('../emails/otp');
const transporter = require('../config/smtp');
require('dotenv').config();

class EmailService {
  static async send(email, code, subject) {
    const mailOptions = {
      from: `"Minha saudade" <${process.env.APP_MAIL}>`,
      to: email,
      subject,
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

module.exports = EmailService;