const winston = require('winston');
const path = require('path');

const { NODE_ENV } = require('../config/env');

const formats = [
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
];

if (NODE_ENV === 'development') {
  formats.push(winston.format.colorize());
  formats.push(winston.format.printf(({ timestamp, level, message, stack }) =>
    `${timestamp} [${level}]: ${stack || message}`
  ));
} else {
  formats.push(winston.format.json());
}

const logger = winston.createLogger({
  level: NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(...formats),
  transports: [
    new winston.transports.Console(),
    ...(NODE_ENV === 'production' ? [
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' }),
    ] : []),
  ],
});

module.exports = logger;
