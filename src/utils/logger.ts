import winston from 'winston';
import { config } from '../config';

// Custom format for structured JSON logging
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Simple format for development
const simpleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: config.logging.format === 'json' ? jsonFormat : simpleFormat,
  defaultMeta: {
    service: 'karbonica-api',
    environment: config.env,
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

// Add file transports in production
if (config.env === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );
  
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    })
  );
}

// Helper functions for structured logging
export const logWithContext = (
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  context: Record<string, any> = {}
) => {
  logger.log(level, message, context);
};

export const logRequest = (
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  userId?: string
) => {
  logger.info('HTTP Request', {
    method,
    path,
    statusCode,
    duration,
    userId,
    type: 'http_request',
  });
};

export const logError = (
  error: Error,
  context: Record<string, any> = {}
) => {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
};

export const logAuthentication = (
  userId: string,
  action: string,
  success: boolean,
  metadata: Record<string, any> = {}
) => {
  logger.info('Authentication event', {
    userId,
    action,
    success,
    type: 'authentication',
    ...metadata,
  });
};

export const logAuthorization = (
  userId: string,
  resource: string,
  action: string,
  allowed: boolean
) => {
  logger.info('Authorization event', {
    userId,
    resource,
    action,
    allowed,
    type: 'authorization',
  });
};

export const logDataAccess = (
  userId: string,
  resourceType: string,
  resourceId: string,
  action: string
) => {
  logger.info('Data access event', {
    userId,
    resourceType,
    resourceId,
    action,
    type: 'data_access',
  });
};
