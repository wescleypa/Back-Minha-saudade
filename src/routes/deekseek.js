const express = require('express');
const router = express.Router();
const controller = require('../controllers/deepseek');

router.post('/send', controller.send);

module.exports = router;