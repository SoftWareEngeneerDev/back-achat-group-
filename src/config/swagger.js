const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Achats Groupés BF - API',
      version: '1.0.0',
      description: 'API REST de la plateforme d\'e-commerce d\'achats groupés - Burkina Faso',
      contact: { name: 'Support', email: 'support@votreplateforme.bf' },
    },
    servers: [
      { url: 'http://localhost:3000/api/v1', description: 'Développement' },
      { url: 'https://api.votreplateforme.bf/api/v1', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/**/*.routes.js'],
};

module.exports = swaggerJsdoc(options);
