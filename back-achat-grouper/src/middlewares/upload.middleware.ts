import multer from 'multer';
import path from 'path';
import { ApiError } from '../utils/api-error.util';
import { MAX_UPLOAD_SIZE, ALLOWED_IMAGE_FORMATS } from '../config/constants';

// Configuration du stockage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// Filtrer les fichiers (seulement images)
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_IMAGE_FORMATS.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Format de fichier non autorisé. Formats acceptés: JPEG, PNG, WebP'));
  }
};

// Configuration de multer
export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE, // 5MB
  },
  fileFilter,
});

/**
 * Middleware pour uploader une seule image
 */
export const uploadSingle = (fieldName: string = 'image') => {
  return upload.single(fieldName);
};

/**
 * Middleware pour uploader plusieurs images
 */
export const uploadMultiple = (fieldName: string = 'images', maxCount: number = 5) => {
  return upload.array(fieldName, maxCount);
};