const path = require('path');
const fs = require('fs').promises;

class ImageService {
  static async getUserImage(userId, type) {
    const imagePath = path.join('./src/users', type, `${userId}.jpg`);
    try {
      return await this.imageToBase64Async(imagePath);
    } catch (error) {
      console.error(`Error loading ${type} image:`, error);
      return null;
    }
  };

  static async getChatImage(chatID) {
    const imagePath = path.join('./src/chats/pic', `${chatID}.jpg`);
    
    try {
      return await this.imageToBase64Async(imagePath);
    } catch (error) {
      console.error(`Error loading ${type} image:`, error);
      return null;
    }
  }

  static async uploadImage(id, dir = './src/users', image) {
    const dirPath = path.join(dir);
    const filePath = path.join(dir, `${id}.jpg`);

    try {
      await fs.mkdir(dirPath, { recursive: true });

      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      await fs.writeFile(filePath, buffer);
      return true;
    } catch (error) {
      console.error('Error uploading image:', error);
      return false;
    }
  }

  static async imageToBase64Async(filePath) {
    try {
      const data = await fs.readFile(filePath);
      return data.toString('base64');
    } catch {
      return null;
    }
  }

  static async enrichWithUserImages(user) {
    const [banner, pic] = await Promise.all([
      this.getUserImage(user.id, 'banner'),
      this.getUserImage(user.id, 'pic')
    ]);

    user.banner = banner;
    user.pic = pic;

    return user;
  }
}

module.exports = ImageService;