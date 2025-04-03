const service = require('../services/deepseek');

class Deepseek {
  static send = async (req, res) => {
    try {
      const { context, input } = req?.body;
      res.status(200).json(await service.send(context, input));
    } catch (err) {
      res.status(400).json(err);
    }
  };
}

module.exports = Deepseek;