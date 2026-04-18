require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const logger = require('./utils/logger');
const { globalLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { initSocket } = require('./sockets/socket');
const { initCronJobs } = require('./jobs/cron');

// Routes
const authRoutes          = require('./modules/auth/auth.routes');
const usersRoutes         = require('./modules/users/users.routes');
const productsRoutes      = require('./modules/products/products.routes');
const groupsRoutes        = require('./modules/groups/groups.routes');
const paymentsRoutes      = require('./modules/payments/payments.routes');
const ordersRoutes        = require('./modules/orders/orders.routes');
const notificationsRoutes = require('./modules/notifications/notification.routes');
const reviewsRoutes       = require('./modules/reviews/reviews.routes');
const disputesRoutes      = require('./modules/disputes/disputes.routes');
const adminRoutes         = require('./modules/admin/admin.routes');
const swaggerSpec         = require('./config/swagger');

const app        = express();
const httpServer = http.createServer(app);

// ============================================================
// MIDDLEWARES GLOBAUX
// ============================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc:     ["'self'", "data:", "https://validator.swagger.io", "http://localhost:3000"],
    },
  },
}));

app.use(cors({
  origin:         env.FRONTEND_URL || '*',
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.IS_DEV ? 'dev' : 'combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));
app.use(globalLimiter);

// ============================================================
// FICHIERS STATIQUES — Avatars et uploads ← AJOUT
// ============================================================
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================================
// DOCUMENTATION SWAGGER
// ============================================================
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss:       '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Achats Groupés BF - API Docs',
}));

// ============================================================
// ROUTES API v1
// ============================================================
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(API_PREFIX, usersRoutes);
app.use(API_PREFIX, productsRoutes);
app.use(API_PREFIX, groupsRoutes);
app.use(API_PREFIX, paymentsRoutes);
app.use(API_PREFIX, ordersRoutes);
app.use(API_PREFIX, notificationsRoutes);
app.use(API_PREFIX, reviewsRoutes);
app.use(API_PREFIX, disputesRoutes);
app.use(API_PREFIX, adminRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date().toISOString() }));

// ============================================================
// GESTION ERREURS
// ============================================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// DÉMARRAGE
// ============================================================
const startServer = async () => {
  try {
    const prisma = require('./config/database');
    await prisma.$connect();
    logger.info('✅ Base de données connectée');

    initSocket(httpServer);
    initCronJobs();

    httpServer.listen(env.PORT, () => {
      logger.info(`🚀 Serveur démarré sur le port ${env.PORT}`);
      logger.info(`📚 Documentation : http://localhost:${env.PORT}/api/v1/docs`);
      logger.info(`🌍 Environnement : ${env.NODE_ENV}`);
    });
  } catch (err) {
    logger.error('Erreur au démarrage:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', async () => {
  logger.info('SIGTERM reçu, arrêt propre...');
  const prisma = require('./config/database');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

startServer();

module.exports = app;