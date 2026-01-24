import jwt from 'jsonwebtoken';
import { config } from '../config/env';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

interface RefreshTokenPayload {
  userId: string;
}

/**
 * Générer un access token JWT
 */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * Générer un refresh token JWT
 */
export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
}

/**
 * Vérifier un access token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as TokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Vérifier un refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
  } catch (error) {
    return null;
  }
}