const JwtService = require('../../services/jwt.service');
const UserService = require('../../services/user.service');

function UserHandler(socket) {
  socket.on('user:update:config', async (data, callback) => {
    try {
      const { column, value } = data;
      if (!column || !value?.toString()) throw new Error('Parâmetros inválidos, tente novamente ou contate o suporte.');
      const { valid, payload } = await JwtService.verifyToken(socket?.userToken);
      if (!socket?.userToken || !valid || payload?.userID !== socket?.userID) {
        await socket.emit('logout');
        throw new Error('Sessão inválida ou expirada, faça login novamente.');
      }

      await UserService.update.config(socket?.userID, column, value);
      return callback({ success: true });
    } catch (err) {
      return callback({
        success: false,
        error: err?.message ?? 'Erro desconhecido'
      });
    }
  });

  socket.on('user:verifyCode:save', async (data, callback) => {
    try {
      const { type, relation, code, time } = data;
      if (type === null || type === undefined || !relation || !code || !time) throw new Error('Parâmetros inválidos, tente novamente ou contate o suporte.');
      const { valid, payload } = await JwtService.verifyToken(socket?.userToken);
      if (!socket?.userToken || !valid || payload?.userID !== socket?.userID) {
        await socket.emit('logout');
        throw new Error('Sessão inválida ou expirada, faça login novamente.');
      }

      const expiry = new Date(Date.now() + Number(time) * 60 * 1000);
      await UserService.verifyCode.save(socket?.userID, type, relation, code, expiry);

      return callback({ success: true, expiry });
    } catch (err) {
      return callback({
        success: false,
        error: err?.message ?? 'Erro desconhecido'
      });
    }
  });
};

module.exports = {
  register: UserHandler
}