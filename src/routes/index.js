const express = require('express');
const router = express.Router();
//const ia = require('./deekseek');
const fs = require('fs').promises;
const path = require('path');
const JwtService = require('../services/jwt.service');

// Define your routes here
router.get('/', (req, res) => {
  res.send('Welcome to the API!');
});

router.get('/:type/pic', async (req, res) => {
  const { type } = req.params;
  if (!type) return res.send('Invalid type');
  const { token, user } = req.query;
  if (!token) return res.send('Invalid token');
  if (!user) return res.send('Invalid user');

  const { valid, payload } = await JwtService.verifyTokenCache(token);

  if (!valid) return res.send('Invalid session');
  //if (Number(payload?.userID) !== Number(user)) return res.send('Invalid session');

  const pic = path.join(__dirname, `../${type === 'user' ? 'users' : 'chats'}`, 'pic', `${user}.jpg`);

  try {
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
  } catch (err) {
    res.send('null');
  }
});

//router.use('/ia', ia);

module.exports = router;