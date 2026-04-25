// ============================================================
// SOCKET.IO — Temps réel
// Djula Market — Burkina Faso
// ============================================================

const { Server } = require('socket.io');
const jwt         = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const logger      = require('../utils/logger');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors      : { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
    pingTimeout  : 30000,
    pingInterval : 10000,
  });

  // ── Middleware auth JWT ───────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token manquant'));
    try {
      const decoded  = jwt.verify(token, JWT_SECRET);
      socket.userId  = decoded.sub;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Token invalide ou expiré'));
    }
  });

  // ── Connexion ─────────────────────────────────────────────
  io.on('connection', (socket) => {
    logger.debug(`[Socket] ✅ Connecté: ${socket.userId} (${socket.userRole})`);

    // Room personnelle de l'utilisateur
    socket.join(`user:${socket.userId}`);

    // ── Rejoindre / quitter une room groupe ────────────────
    socket.on('join:group', (groupId) => {
      if (!groupId || typeof groupId !== 'string') return;
      socket.join(`group:${groupId}`);
      logger.debug(`[Socket] User ${socket.userId} → group:${groupId}`);
    });

    socket.on('leave:group', (groupId) => {
      if (!groupId) return;
      socket.leave(`group:${groupId}`);
    });

    // ── Ping / pong (keep-alive applicatif) ────────────────
    socket.on('ping', () => socket.emit('pong'));

    // ── Déconnexion ────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.debug(`[Socket] ❌ Déconnecté: ${socket.userId} — ${reason}`);
    });

    // ── Erreur socket ──────────────────────────────────────
    socket.on('error', (err) => {
      logger.error(`[Socket] Erreur: ${socket.userId} — ${err.message}`);
    });
  });

  logger.info('✅ Socket.io initialisé');
  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io non initialisé — appelez initSocket() d\'abord');
  return io;
};

module.exports = { initSocket, getIO };