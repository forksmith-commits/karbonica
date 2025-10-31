import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './index';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Karbonica Carbon Registry API',
      version: '1.0.0',
      description: 'Carbon Credit Registry Platform with Cardano blockchain integration',
      contact: {
        name: 'Karbonica Team',
        url: 'https://karbonica.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
      {
        url: 'https://api.karbonica.com',
        description: 'Production server',
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
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            company: { type: 'string', nullable: true },
            role: {
              type: 'string',
              enum: ['developer', 'verifier', 'administrator', 'buyer'],
            },
            emailVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            code: { type: 'string' },
            title: { type: 'string' },
            detail: { type: 'string' },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' },
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Admin', description: 'Admin panel endpoints (requires admin role)' },
      { name: 'Health', description: 'Health check endpoints' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/routes/admin/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
