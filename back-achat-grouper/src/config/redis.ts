import { createClient } from 'redis';
import { config } from './env';
import { logger } from '../utils/logger.util';

// Créer le client Redis
const redisClient = createClient({
  socket: {
    host: config.redis.host,
    port: config.redis.port,
  },
  password: config.redis.password,
});

// Gestion des événements
redisClient.on('connect', () => {
  logger.info('✅ Redis connected successfully');
});

redisClient.on('error', (err) => {
  logger.error('❌ Redis connection error:', err);
});

// Connexion Redis
export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    // Ne pas bloquer l'application si Redis n'est pas disponible
  }
};

// Déconnexion Redis
export const disconnectRedis = async (): Promise<void> => {
  try {
    await redisClient.quit();
    logger.info('Redis disconnected');
  } catch (error) {
    logger.error('Error disconnecting Redis:', error);
  }
};

// Utilitaires Redis
export class RedisCache {
  // Définir une valeur avec expiration
  static async set(key: string, value: any, expirationInSeconds: number = 3600): Promise<void> {
    try {
      await redisClient.setEx(key, expirationInSeconds, JSON.stringify(value));
    } catch (error) {
      logger.error('Redis SET error:', error);
    }
  }

  // Récupérer une valeur
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis GET error:', error);
      return null;
    }
  }

  // Supprimer une clé
  static async delete(key: string): Promise<void> {
    try {
      await redisClient.del(key);
    } catch (error) {
      logger.error('Redis DELETE error:', error);
    }
  }

  // Supprimer plusieurs clés par pattern
  static async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      logger.error('Redis DELETE PATTERN error:', error);
    }
  }

  // Vérifier si une clé existe
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      return false;
    }
  }
}

export { redisClient };