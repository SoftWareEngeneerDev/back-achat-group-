require('dotenv').config();

const required = (key) => {
  if (!process.env[key]) {
    throw new Error(`Variable d'environnement manquante : ${key}`);
  }
  return process.env[key];
};

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 3000,
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:4200',

  DATABASE_URL: process.env.DATABASE_URL,

  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_change_in_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,

  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || 'noreply@votreplateforme.bf',
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME || 'Achats Groupés BF',

  CINETPAY_API_KEY: process.env.CINETPAY_API_KEY,
  CINETPAY_SITE_ID: process.env.CINETPAY_SITE_ID,
  CINETPAY_NOTIFY_URL: process.env.CINETPAY_NOTIFY_URL,
  CINETPAY_RETURN_URL: process.env.CINETPAY_RETURN_URL,

  FEDAPAY_SECRET_KEY: process.env.FEDAPAY_SECRET_KEY,
  FEDAPAY_ENVIRONMENT: process.env.FEDAPAY_ENVIRONMENT || 'sandbox',

  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION || 'eu-west-1',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,

  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12,
  OTP_EXPIRES_IN_MINUTES: parseInt(process.env.OTP_EXPIRES_IN_MINUTES) || 10,

  IS_DEV: process.env.NODE_ENV === 'development',
  IS_PROD: process.env.NODE_ENV === 'production',
};
