const express = require('express');
const router = express.Router();
const ia = require('./deekseek');

// Define your routes here
router.get('/', (req, res) => {
  res.send('Welcome to the API!');
});

router.use('/ia', ia);

module.exports = router;