const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Djula Market — API',
      version: '1.0.0',
      description: `
## API REST — Plateforme d'achats groupés Burkina Faso

### Authentification
Tous les endpoints protégés nécessitent un token JWT Bearer.
\`\`\`
Authorization: Bearer <token>
\`\`\`

### Flow complet d'un achat groupé
1. \`POST /auth/register\` → Inscription
2. \`POST /auth/verify-otp\` → Vérification SMS
3. \`GET /groups\` → Voir les groupes disponibles
4. \`POST /groups/:id/join\` → Rejoindre un groupe
5. \`POST /payments/deposit\` → Payer le dépôt
6. \`POST /payments/final\` → Payer le solde (quand seuil atteint)
7. \`GET /orders/me\` → Suivre sa commande
      `,
      contact: {
        name : 'Support Djula Market',
        email: 'support@djulamarket.bf',
      },
    },
    servers: [
      { url: 'http://localhost:3000/api/v1', description: '🔧 Développement' },
      { url: 'https://api.djulamarket.bf/api/v1', description: '🚀 Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        // ── Commun ──────────────────────────────────────────────
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                code   : { type: 'string' },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page      : { type: 'integer', example: 1 },
            limit     : { type: 'integer', example: 20 },
            total     : { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 5 },
            hasNext   : { type: 'boolean' },
            hasPrev   : { type: 'boolean' },
          },
        },
        // ── User ────────────────────────────────────────────────
        User: {
          type: 'object',
          properties: {
            id          : { type: 'string', format: 'uuid' },
            name        : { type: 'string', example: 'Kofi Traoré' },
            phone       : { type: 'string', example: '+22676528609' },
            email       : { type: 'string', format: 'email' },
            role        : { type: 'string', enum: ['MEMBER', 'SUPPLIER', 'ADMIN'] },
            status      : { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'BANNED', 'PENDING_VERIFICATION'] },
            city        : { type: 'string', example: 'Ouagadougou' },
            trustScore  : { type: 'number', example: 95 },
            referralCode: { type: 'string', example: 'KOFI7A2F' },
            avatarUrl   : { type: 'string', nullable: true },
            createdAt   : { type: 'string', format: 'date-time' },
          },
        },
        // ── Auth ────────────────────────────────────────────────
        AuthResponse: {
          type: 'object',
          properties: {
            accessToken  : { type: 'string' },
            refreshToken : { type: 'string' },
            expiresIn    : { type: 'integer', example: 900 },
            user         : { $ref: '#/components/schemas/User' },
          },
        },
        // ── Product ─────────────────────────────────────────────
        Product: {
          type: 'object',
          properties: {
            id            : { type: 'string', format: 'uuid' },
            name          : { type: 'string', example: 'Samsung Galaxy A55' },
            description   : { type: 'string' },
            soloPrice     : { type: 'number', example: 285000 },
            baseGroupPrice: { type: 'number', example: 185250 },
            stock         : { type: 'integer', example: 245 },
            imagesUrls    : { type: 'array', items: { type: 'string' } },
            status        : { type: 'string', enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED'] },
            rating        : { type: 'number', example: 4.5 },
            reviewCount   : { type: 'integer', example: 47 },
            category: {
              type: 'object',
              properties: {
                id  : { type: 'string' },
                name: { type: 'string', example: 'Électronique' },
                slug: { type: 'string', example: 'electronique' },
              },
            },
            supplier: {
              type: 'object',
              properties: {
                id         : { type: 'string' },
                companyName: { type: 'string', example: 'Tech Ouaga SARL' },
                rating     : { type: 'number' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // ── Group ───────────────────────────────────────────────
        Group: {
          type: 'object',
          properties: {
            id             : { type: 'string', format: 'uuid' },
            title          : { type: 'string' },
            status         : { type: 'string', enum: ['OPEN', 'THRESHOLD_REACHED', 'CLOSED', 'FAILED', 'CANCELLED'] },
            minParticipants: { type: 'integer', example: 10 },
            maxParticipants: { type: 'integer', example: 50 },
            currentCount   : { type: 'integer', example: 8 },
            currentPrice   : { type: 'number', example: 188600 },
            depositPercent : { type: 'number', example: 0.1 },
            expiresAt      : { type: 'string', format: 'date-time' },
            reachedAt      : { type: 'string', format: 'date-time', nullable: true },
            pricingTiers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  participantCount: { type: 'integer' },
                  discountPercent : { type: 'number' },
                  priceAtTier     : { type: 'number' },
                },
              },
            },
            product : { $ref: '#/components/schemas/Product' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // ── Payment ─────────────────────────────────────────────
        Payment: {
          type: 'object',
          properties: {
            id            : { type: 'string', format: 'uuid' },
            amount        : { type: 'number', example: 18860 },
            currency      : { type: 'string', example: 'XOF' },
            method        : { type: 'string', enum: ['ORANGE_MONEY', 'MOOV_MONEY', 'LIGDICASH', 'CARD', 'BANK_TRANSFER'] },
            type          : { type: 'string', enum: ['DEPOSIT', 'FINAL_PAYMENT', 'REFUND', 'COMMISSION'] },
            status        : { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'ESCROWED'] },
            transactionRef: { type: 'string' },
            createdAt     : { type: 'string', format: 'date-time' },
          },
        },
        // ── Order ───────────────────────────────────────────────
        Order: {
          type: 'object',
          properties: {
            id              : { type: 'string', format: 'uuid' },
            totalAmount     : { type: 'number', example: 215000 },
            commissionAmount: { type: 'number', example: 15050 },
            status          : { type: 'string', enum: ['CREATED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] },
            trackingCode    : { type: 'string', nullable: true },
            shippedAt       : { type: 'string', format: 'date-time', nullable: true },
            deliveredAt     : { type: 'string', format: 'date-time', nullable: true },
            createdAt       : { type: 'string', format: 'date-time' },
          },
        },
        // ── Dispute ─────────────────────────────────────────────
        Dispute: {
          type: 'object',
          properties: {
            id         : { type: 'string', format: 'uuid' },
            subject    : { type: 'string', example: 'Produit non conforme' },
            description: { type: 'string' },
            status     : { type: 'string', enum: ['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'] },
            resolvedBy : { type: 'string', nullable: true },
            createdAt  : { type: 'string', format: 'date-time' },
          },
        },
        // ── Notification ─────────────────────────────────────────
        Notification: {
          type: 'object',
          properties: {
            id       : { type: 'string', format: 'uuid' },
            type     : { type: 'string', enum: ['NEW_MEMBER', 'PRICE_DROP', 'GROUP_SUCCESS', 'GROUP_FAILED', 'PAYMENT_DUE', 'DELIVERY_UPDATE', 'SYSTEM'] },
            title    : { type: 'string' },
            body     : { type: 'string' },
            isRead   : { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // ── Review ──────────────────────────────────────────────
        Review: {
          type: 'object',
          properties: {
            id       : { type: 'string', format: 'uuid' },
            rating   : { type: 'integer', minimum: 1, maximum: 5 },
            comment  : { type: 'string', nullable: true },
            user: {
              type: 'object',
              properties: {
                name     : { type: 'string' },
                avatarUrl: { type: 'string', nullable: true },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // ── Supplier ────────────────────────────────────────────
        Supplier: {
          type: 'object',
          properties: {
            id            : { type: 'string', format: 'uuid' },
            companyName   : { type: 'string', example: 'Tech Ouaga SARL' },
            status        : { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] },
            commissionRate: { type: 'number', example: 0.07 },
            validatedAt   : { type: 'string', format: 'date-time', nullable: true },
            createdAt     : { type: 'string', format: 'date-time' },
          },
        },
      },
      parameters: {
        pageParam: {
          in: 'query', name: 'page',
          schema: { type: 'integer', default: 1, minimum: 1 },
          description: 'Numéro de page',
        },
        limitParam: {
          in: 'query', name: 'limit',
          schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
          description: 'Nombre d\'éléments par page',
        },
      },
      responses: {
        Unauthorized: {
          description: '401 — Token manquant ou invalide',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Forbidden: {
          description: '403 — Accès refusé',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: '404 — Ressource introuvable',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Conflict: {
          description: '409 — Conflit (doublon)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        TooManyRequests: {
          description: '429 — Trop de requêtes',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth',          description: ' Authentification — Inscription, connexion, OTP' },
      { name: 'Users',         description: ' Utilisateurs — Profil, dashboard, notifications' },
      { name: 'Products',      description: ' Produits — Catalogue, catégories, avis' },
      { name: 'Groups',        description: ' Groupes — Achats groupés, participation' },
      { name: 'Payments',      description: ' Paiements — Dépôts, soldes, remboursements' },
      { name: 'Orders',        description: ' Commandes — Suivi, expédition, livraison' },
      { name: 'Disputes',      description: ' Litiges — Réclamations membres/fournisseurs' },
      { name: 'Reviews',       description: ' Avis — Notes et commentaires produits' },
      { name: 'Notifications', description: ' Notifications — Alertes temps réel' },
      { name: 'Supplier',      description: ' Fournisseur — Gestion produits et commandes' },
      { name: 'Admin',         description: ' Administration — Gestion plateforme' },
    ],
  },
  apis: ['./src/modules/**/*.routes.js'],
};

module.exports = swaggerJsdoc(options);