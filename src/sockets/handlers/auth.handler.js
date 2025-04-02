class AuthHandler {
  constructor(authService, JwtService, UserService, ChatService, EmailService) {
    this.authService = authService;
    this.JwtService = JwtService;
    this.UserService = UserService;
    this.ChatService = ChatService;
    this.EmailService = EmailService;
  }

  async login(socket, data, callback) {
    try {
      var user = await this.authService.login(data);

      if (!user) throw new Error('Falha ao verificar login');

      const chats = await this.ChatService.getAllChats(user?.id);

      user['chats'] = chats || [];

      callback({ status: 'success', data: user });
    } catch (err) {
      this.handleError(callback, err);
    }
  };

  async verifyToken(socket, token, callback) {
    try {
      const userID = await this.JwtService.verifyToken(token?.token ?? token);

      var user = await this.UserService.findByID(userID);

      if (!user) throw new Error('Falha ao verificar sessão');

      user = Object.assign({}, user, { token: token?.token ?? token });

      const chats = await this.ChatService.getAllChats(userID);
      user['chats'] = chats || [];

      callback({ status: 'success', data: user });
    } catch (err) {
      console.error(err);
      this.handleError(callback, err);
    }
  };

  async forgot(socket, userMail, callback) {
    try {
      if (!userMail && !userMail?.email) throw new Error('Invalid mail');
      const email = userMail || userMail?.email;

      const { status, code } = await this.authService.generateCodeByMail(email);
      if (!status) throw new Error('Falha ao enviar código de verificação');

      await this.EmailService.send(email, code, 'Alteração de senha - Minha saudade');

      callback({ status: 'success', data: { code, email } });
    } catch (err) {
      console.error(err);
      this.handleError(callback, err);
    }
  };

  async verifyCode(socket, data, callback) {
    try {
      if (!data?.email || !data?.code) throw new Error('Falha ao verificar, tente novamente ou contate o suporte.');
      const { email, code } = data;

      const result = await this.authService.verifyCodeRequest(email, code);
      const token = await this.JwtService.create(result);

      callback({ status: 'success', token });
    } catch (err) {
      console.error(err);
      this.handleError(callback, err);
    }
  };

  async changePW(socket, data, callback) {
    try {
      if (!data?.email || !data?.token || !data?.pass) throw new Error('Falha ao verificar, tente novamente ou contate o suporte.');
      const { email, token, pass } = data;

      const { valid, payload } = await this.JwtService.verifyTokenCache(token);

      if (!valid) throw new Error('Sessão inválida ou expirada, faça a solicitação novamente.');
      if (payload?.email !== email) throw new Error('Sessão inválida ou expirada, faça a solicitação novamente.');

      const userID = payload?.userID;

      await this.JwtService.delete(token);
      await this.UserService.updateByID(userID, 'password', pass);

      var user = await this.UserService.findByID(userID);

      if (!user) throw new Error('Senha alterada mas houve falha ao tentar logar, acesse o login com a nova senha.');

      const tk = await this.JwtService.create(user);

      user = Object.assign({}, user, { token: tk?.token });

      const chats = await this.ChatService.getAllChats(userID);
      user['chats'] = chats || [];

      callback({ status: 'success', data: user });
    } catch (err) {
      console.error(err);
      this.handleError(callback, err);
    }
  };

  async register(socket, data, callback) {
    try {
      if (!data?.name || !data?.email || !data?.password) throw new Error('Invalid parms, contate o suporte.');
      const { name, email, password } = data;
      const userID = await this.authService.register(name, email, password);

      const { status, code } = await this.authService.generateCodeByMail(email);

      if (!status) throw new Error('Falha ao gerar código de confirmação, tente novamente.');
      
      await this.EmailService.send(email, code, 'Confirmação de cadastro - Minha saudade');

      callback({ status: 'success', data: { code, email } });
    } catch (err) {
      console.error(err);
      this.handleError(callback, err);
    }
  };




  handleError(callback, error) {
    var errorMessage = error;

    errorMessage = error?.message?.includes('Duplicate entry') ? 'Usuário já está registrado, utilize outro e-mail ou faça logn.' : errorMessage;
    console.error('Auth error:', errorMessage);
    callback({
      status: 'error',
      error: errorMessage || 'Erro desconhecido'
    });
  }

  static register(io, socket, authService, JwtService, UserService, ChatService, EmailService) {
    const handler = new AuthHandler(authService, JwtService, UserService, ChatService, EmailService);

    socket.on('login', (data, callback) => handler.login(socket, data, callback));
    socket.on('register', (data, callback) => handler.register(socket, data, callback));
    socket.on('verifyToken', (data, callback) => handler.verifyToken(socket, data, callback));
    socket.on('auth:forgot', (data, callback) => handler.forgot(socket, data, callback));
    socket.on('auth:verifyCode', (data, callback) => handler.verifyCode(socket, data, callback));
    socket.on('auth:changepw', (data, callback) => handler.changePW(socket, data, callback));
  }
}

module.exports = AuthHandler;