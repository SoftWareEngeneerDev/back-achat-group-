import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Application
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  apiVersion: process.env.API_VERSION || 'v1',

  // Database
  databaseUrl: process.env.DATABASE_URL!,

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // Cloudinary
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    apiSecret: process.env.CLOUDINARY_API_SECRET!,
  },

  // SendGrid
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY!,
    fromEmail: process.env.FROM_EMAIL || 'noreply@groupbuy.com',
    fromName: process.env.FROM_NAME || 'GroupBuy',
  },

  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER!,
  },

  // Payment Providers
  payment: {
    orangeMoney: {
      apiKey: process.env.ORANGE_MONEY_API_KEY!,
      secret: process.env.ORANGE_MONEY_SECRET!,
    },
    moovMoney: {
      apiKey: process.env.MOOV_MONEY_API_KEY!,
      secret: process.env.MOOV_MONEY_SECRET!,
    },
    ligdicash: {
      apiKey: process.env.LIGDICASH_API_KEY!,
      secret: process.env.LIGDICASH_SECRET!,
    },
  },

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Business
  platformCommission: parseFloat(process.env.PLATFORM_COMMISSION || '7'), // 7%
  depositPercentage: parseFloat(process.env.DEPOSIT_PERCENTAGE || '10'), // 10%
};

// Validation des variables obligatoires
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Environment variable ${envVar} is required`);
  }
}