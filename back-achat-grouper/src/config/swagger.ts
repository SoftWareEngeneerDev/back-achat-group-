import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GroupBuy API Documentation',
      version: '1.0.0',
      description: 'API RESTful pour la plateforme d\'achats groupés GroupBuy',
      contact: {
        name: 'GroupBuy Support',
        email: 'support@groupbuy.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}/api/${config.apiVersion}`,
        description: 'Serveur de développement',
      },
      {
        url: `https://api.groupbuy.com/api/${config.apiVersion}`,
        description: 'Serveur de production',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentification et gestion des utilisateurs' },
      { name: 'Groups', description: 'Gestion des groupes d\'achat' },
      { name: 'Products', description: 'Gestion des produits' },
      { name: 'Payments', description: 'Gestion des paiements' },
      { name: 'Orders', description: 'Gestion des commandes' },
      { name: 'Admin', description: 'Administration de la plateforme' },
    ],
  },
  apis: ['./src/modules/**/*.routes.ts'], // Chemins vers les fichiers de routes
};

export const swaggerSpec = swaggerJsdoc(options);