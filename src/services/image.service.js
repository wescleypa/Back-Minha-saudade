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