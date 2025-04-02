const UserService = require('../services/auth');
const crypto = require('crypto');
const Chats = require('../services/chats');
const jwt = require('jsonwebtoken');
const secretjwt = "Megsone476!";

class User {
  static createToken = async (userData) => {
    const payload = {
      id: userData?.id,
      name: userData?.name,
      email: userData?.email
    };

    const token = jwt.sign(payload, secretjwt, {
      expiresIn: '12h', // mover para o env
      algorithm: 'HS256' // Algoritmo padrão mover para o env
    });

    // Decodificar para obter a expiração
    const decoded = jwt.decode(token);
    const expiry = new Date(decoded.exp * 1000);
    await UserService.saveToken(userData?.id, token, expiry);

    return { token, expiry };
  };

  static verifyTokenCache = async (token) => {
    try {
      const decoded = jwt.verify(token, secretjwt);

      // Verifica se o token expirou
      const currentTime = Math.floor(Date.now() / 1000); // Tempo atual em segundos
      if (decoded.exp && decoded.exp < currentTime) {
        return { valid: false, reason: 'Token expirado' };
      }

      return { valid: true, payload: decoded };
    } catch (error) {
      // Diferencia os tipos de erro
      if (error.name === 'TokenExpiredError') {
        return { valid: false, reason: 'Token expirado' };
      } else if (error.name === 'JsonWebTokenError') {
        return { valid: false, reason: 'Token inválido' };
      } else {
        return { valid: false, reason: 'Erro ao verificar token' };
      }
    }
  };

  static create = async (userData) => {
    try {
      const { name, email, password } = userData;

      // Gera um código aleatório de 6 dígitos (mover para o env)
      const verificationCode = crypto.randomInt(1000, 9999).toString();

      const userID = await UserService.create(
        { name, email, password },
        verificationCode
      );

      return { status: "success", data: { id: userID, code: verificationCode } };
    } catch (err) {
      throw err;
    }
  };

  static login = async (userData) => {
    try {
      const { email, password } = userData;

      var result = await UserService.login({ email, password });
      const chats = await Chats.getAllChats(result?.id);
      result = Object.assign({}, { ...result, chats });

      if (result && result?.id) {
        const { token, expiry } = await this.createToken(result);
        return { status: 'success', data: { ...result, token, expiry } };
      } else {
        return { status: 'error', error: 'Dados inválidos ou usuário não registrado.' };
      }
    } catch (err) {
      throw err;
    }
  };

  static verifyCode = async (userData) => {
    try {
      const { email, code } = userData;
      const result = await UserService.verifyCode(email, code);

      if (result) {
        const { token, expiry } = await this.createToken(result);

        return { status: 'success', data: { ...result, token, expiry } };
      } else {
        return { status: 'error', error: 'Código de verificação inválido ou expirado, enviei outro para o e-mail informado.' };
      }
    } catch (err) {
      throw err;
    }
  };

  static verifyToken = async (userData) => {
    try {
      const { user, token } = userData;
      var result = await UserService.verifyToken(user, token);
      const chats = await Chats.getAllChats(user);
      result = Object.assign({}, { ...result, chats });

      if (result) {
        return { status: 'success', data: result };
      } else {
        return { status: 'error', error: 'Sessão inválida ou expirada, faça login novamente.' };
      }
    } catch (err) {
      throw err;
    }
  };

  static resetpassword = async (email) => {
    try {
      const verificationCode = crypto.randomInt(1000, 9999).toString();
      const result = await UserService.resetpassword(email, verificationCode);

      if (result) {
        return { status: 'success', data: { email, code: verificationCode } };
      } else {
        return { status: 'error', error: 'Falha ao resetar senha, tente novamente ou contate o suporte.' };
      }
    } catch (err) {
      throw err;
    }
  };

  static updateProfile = async (data) => {
    try {
      const { token, input, value } = data;
      const { valid, payload } = await this.verifyTokenCache(token);

      if (!valid) {
        return { status: 'error', error: 'Token inválido ou expirado, faça login novamente', logout: true };
      } else {
        const result = await UserService.updateProfile(payload?.id, input, value);

        if (result) {
          return { status: 'success' };
        } else {
          return { status: 'error', error: 'Falha ao atualizar, tente novamente ou refaça login.' };
        }
      }
    } catch (err) {
      throw err;
    }
  };

  static changepw = async (data) => {
    try {
      const { token, pass, actual } = data;
      const { valid, payload } = await this.verifyTokenCache(token);

      if (!valid) {
        return { status: 'error', error: 'Token inválido ou expirado, faça login novamente', logout: true };
      } else {
        const result = await UserService.changepw(payload?.id, actual, pass);

        if (result) {
          if (result?.logout) {
            return { status: 'error', error: 'Token inválido ou expirado, faça login novamente', logout: true };
          } else {
            return { status: 'success' };
          }
        } else {
          return { status: 'error', error: 'Falha ao atualizar, tente novamente ou refaça login.' };
        }
      }
    } catch (err) {
      throw err;
    }
  };
};

module.exports = User;