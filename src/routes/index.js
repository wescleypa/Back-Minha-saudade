const express = require('express');
const router = express.Router();
const ia = require('./deekseek');
const AuthService = require('../services/auth.service');
const JwtService = require('../services/jwt.service');

// Define your routes here
router.get('/', (req, res) => {
  res.send('Welcome to the API!');
});

router.get('/user/pic', async (req, res) => {
  const { token, user } = req.query;
  if (!token) return res.send('Invalid token');
  if (!user) return res.send('Invalid user');

  const { valid, payload } = await JwtService.verifyTokenCache(token);

  if (!valid) return res.send('Invalid session');
  if (payload?.id !== user) return res.send('Invalid session');

  const pic = path.join(__dirname, '../users', 'pic', `${user}.jpg`);

  const stats = await fs.stat(pic);
  if (!stats.isFile()) throw new Error('Não é um arquivo');

  // 4. Determine o tipo MIME (importante para o browser)
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif'
  };
  const ext = path.extname(pic).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  // 5. Envie a imagem
  res.setHeader('Content-Type', contentType);
  res.sendFile(pic);
});

router.use('/ia', ia);

module.exports = router;