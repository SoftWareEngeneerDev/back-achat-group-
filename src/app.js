require('dotenv').config();
const express     = require('express');
const http        = require('http');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const morgan      = require('morgan');
const path        = require('path');
const swaggerUi   = require('swagger-ui-express');

const env          = require('./config/env');
const logger       = require('./utils/logger');
const { globalLimiter }                  = require('./middleware/rateLimit');
const { errorHandler, notFoundHandler }  = require('./middleware/errorHandler');
const { initSocket }   = require('./sockets/socket');
const { initCronJobs } = require('./jobs/cron');

// ── Routes ───────────────────────────────────────────────────
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
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc : ["'self'"],
      scriptSrc  : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc   : ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc     : ["'self'", "data:", "https://validator.swagger.io", `http://localhost:${env.PORT}`],
    },
  },
}));

const corsOptions = {
  origin: env.IS_DEV
    ? (origin, cb) => cb(null, true)
    : env.FRONTEND_URL,
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(env.IS_DEV ? 'dev' : 'combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip  : (req) => req.url === '/health',
}));
app.use(globalLimiter);

// ============================================================
// FICHIERS STATIQUES
// ============================================================
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge : '7d',
  etag   : true,
}));

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/health', async (req, res) => {
  try {
    const prisma = require('./config/database');
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status    : 'OK',
      timestamp : new Date().toISOString(),
      uptime    : Math.floor(process.uptime()) + 's',
      db        : 'connected',
    });
  } catch {
    res.status(503).json({ status: 'ERROR', db: 'disconnected' });
  }
});

// ============================================================
// DOCUMENTATION SWAGGER (dev uniquement)
// ============================================================
if (env.IS_DEV) {
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss      : '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Djula Market — API Docs',
  }));
}

// ============================================================
// ROUTES API v1
// ============================================================
const V1 = '/api/v1';

app.use(`${V1}/auth`,          authRoutes);
app.use(`${V1}/users`,         usersRoutes);
app.use(V1,                    productsRoutes);   // ← monté sur /api/v1 pour /products, /categories, /admin/categories
app.use(V1,                    groupsRoutes);    // ← /supplier/groups, /admin/groups
app.use(`${V1}/payments`,      paymentsRoutes);
app.use(V1,                    ordersRoutes);    // ← /supplier/orders
app.use(`${V1}/notifications`, notificationsRoutes);
app.use(`${V1}/reviews`,       reviewsRoutes);
app.use(`${V1}/disputes`,      disputesRoutes);
app.use(`${V1}/admin`,         adminRoutes);

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
    logger.info('✅ WebSocket initialisé');

    initCronJobs();
    logger.info('✅ Cron jobs démarrés');

    httpServer.listen(env.PORT, () => {
      logger.info(`🚀 Djula Market API démarrée sur le port ${env.PORT}`);
      if (env.IS_DEV) logger.info(`📚 Docs : http://localhost:${env.PORT}/api/v1/docs`);
      logger.info(`🌍 Environnement : ${env.NODE_ENV}`);
    });
  } catch (err) {
    logger.error('❌ Erreur au démarrage:', err);
    process.exit(1);
  }
};

// ── Arrêt propre ─────────────────────────────────────────────
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} reçu — arrêt propre...`);
  try {
    const prisma = require('./config/database');
    await prisma.$disconnect();
    logger.info('✅ Base de données déconnectée');
  } catch {}
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('⚠️  Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

startServer();

module.exports = app;
