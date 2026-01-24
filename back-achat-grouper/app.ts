import express, { Application, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/env';
import { swaggerSpec } from './config/swagger';

// Middlewares
import { corsMiddleware } from './middlewares/cors.middleware';
import { helmetMiddleware } from './middlewares/helmet.middleware';
import { globalRateLimiter } from './middlewares/rateLimit.middleware';
import { errorMiddleware } from './middlewares/error.middleware';

// Routes
import authRoutes from './modules/auth/auth.routes';
import groupsRoutes from './modules/groups/groups.routes';
// TODO: Importer les autres routes (products, payments, etc.)

const app: Application = express();

// ====================================
// MIDDLEWARES GLOBAUX
// ====================================

// Sécurité
app.use(helmetMiddleware);
app.use(corsMiddleware);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting global
app.use(globalRateLimiter);

// Logs des requêtes (en développement)
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ====================================
// ROUTES
// ====================================

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// Documentation Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes API v1
const apiV1 = `/api/${config.apiVersion}`;

app.use(`${apiV1}/auth`, authRoutes);
app.use(`${apiV1}/groups`, groupsRoutes);
// TODO: Ajouter les autres routes
// app.use(`${apiV1}/products`, productsRoutes);
// app.use(`${apiV1}/payments`, paymentsRoutes);
// app.use(`${apiV1}/orders`, ordersRoutes);
// app.use(`${apiV1}/categories`, categoriesRoutes);
// app.use(`${apiV1}/reviews`, reviewsRoutes);
// app.use(`${apiV1}/admin`, adminRoutes);

// Route 404
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.originalUrl,
  });
});

// ====================================
// GESTION DES ERREURS
// ====================================
app.use(errorMiddleware);

export default app;