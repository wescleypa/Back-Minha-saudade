class AuthHandler {
  constructor(authService, JwtService) {
    this.authService = authService;
    this.JwtService = JwtService;
  }

  async login(socket, data, callback) {
    try {
      const result = await this.authService.login(data);

      callback({ status: 'success', data: result });
    } catch (err) {
      this.handleError(callback, err);
    }
  };

  async verifyToken(socket, token, callback) {
    try {
      const result = await this.JwtService.verifyToken(token);

      callback({ status: 'success', data: result });
    } catch (err) {
      this.handleError(callback, err);
    }
  }

  handleError(callback, error) {
    console.error('Auth error:', error);
    callback({
      status: 'error',
      error: error.message || 'Erro desconhecido no login'
    });
  }

  static register(io, socket, authService, JwtService) {
    const handler = new AuthHandler(authService, JwtService);

    socket.on('login', (data, callback) => handler.login(socket, data, callback));
    socket.on('verifyToken', (data, callback) => handler.verifyToken(socket, data, callback));
  }
}

module.exports = AuthHandler;