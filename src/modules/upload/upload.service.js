// ============================================================
// UPLOAD SERVICE — Gestion des images via Cloudinary
// Djula Market — Burkina Faso
// ============================================================

const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// ── Configuration Cloudinary ──────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key   : process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure    : true,
});

// ── Constantes ────────────────────────────────────────────────
const MAX_FILE_SIZE   = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES   = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGES      = 4;
const MIN_IMAGES      = 1;

class UploadService {

  /**
   * Valider un fichier image
   */
  validateFile(file) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      const err = new Error('Format non supporté. Utilisez JPG, PNG ou WEBP');
      err.status = 400; throw err;
    }
    if (file.size > MAX_FILE_SIZE) {
      const err = new Error(`Image trop lourde. Maximum ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      err.status = 400; throw err;
    }
  }

  /**
   * Uploader une image vers Cloudinary
   */
  async uploadImage(file, folder = 'products') {
    this.validateFile(file);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder        : `djula-market/${folder}`,
          transformation: [
            { width: 1200, height: 1200, crop: 'limit' }, // max 1200x1200
            { quality: 'auto:good' },                      // compression auto
            { fetch_format: 'auto' },                      // format optimal (webp si supporté)
          ],
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        },
        (error, result) => {
          if (error) {
            const err = new Error('Erreur lors de l\'upload de l\'image');
            err.status = 500;
            reject(err);
          } else {
            resolve({
              url      : result.secure_url,
              publicId : result.public_id,
              width    : result.width,
              height   : result.height,
              format   : result.format,
              size     : result.bytes,
            });
          }
        }
      );

      // Convertir le buffer en stream
      const readable = new Readable();
      readable.push(file.buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });
  }

  /**
   * Uploader plusieurs images (3-4 max)
   */
  async uploadMultipleImages(files, folder = 'products') {
    if (!files || files.length === 0) {
      const err = new Error('Aucune image fournie');
      err.status = 400; throw err;
    }

    if (files.length > MAX_IMAGES) {
      const err = new Error(`Maximum ${MAX_IMAGES} images autorisées`);
      err.status = 400; throw err;
    }

    // Upload en parallèle
    const results = await Promise.all(
      files.map(file => this.uploadImage(file, folder))
    );

    return results.map(r => r.url);
  }

  /**
   * Supprimer une image de Cloudinary
   */
  async deleteImage(publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch {
      // Non bloquant si la suppression échoue
    }
  }

  /**
   * Extraire le publicId depuis une URL Cloudinary
   */
  extractPublicId(url) {
    if (!url || !url.includes('cloudinary.com')) return null;
    const parts = url.split('/');
    const filename = parts[parts.length - 1].split('.')[0];
    const folder   = parts.slice(-3, -1).join('/');
    return `${folder}/${filename}`;
  }
}

module.exports = new UploadService();