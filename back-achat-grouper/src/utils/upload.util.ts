import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env';
import { logger } from './logger.util';
import fs from 'fs';

// Configuration Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

/**
 * Uploader une image sur Cloudinary
 */
export async function uploadImage(filePath: string, folder: string = 'products'): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `groupbuy/${folder}`,
      resource_type: 'image',
    });

    // Supprimer le fichier local après upload
    fs.unlinkSync(filePath);

    logger.info(`Image uploaded to Cloudinary: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    logger.error('Error uploading to Cloudinary:', error);
    throw error;
  }
}

/**
 * Uploader plusieurs images
 */
export async function uploadMultipleImages(
  filePaths: string[],
  folder: string = 'products'
): Promise<string[]> {
  const uploadPromises = filePaths.map((filePath) => uploadImage(filePath, folder));
  return Promise.all(uploadPromises);
}

/**
 * Supprimer une image de Cloudinary
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    // Extraire le public_id de l'URL
    const publicId = imageUrl.split('/').slice(-2).join('/').split('.')[0];

    await cloudinary.uploader.destroy(`groupbuy/${publicId}`);
    logger.info(`Image deleted from Cloudinary: ${publicId}`);
  } catch (error) {
    logger.error('Error deleting from Cloudinary:', error);
    throw error;
  }
}