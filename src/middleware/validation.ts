import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { logger } from '../utils/logger';

export class ValidationError extends Error {
  constructor(
    public errors: Array<{ field: string; message: string }>,
    public statusCode: number = 400
  ) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

export const validateRequest = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        logger.warn('Request validation failed', {
          path: req.path,
          errors,
        });

        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          title: 'Validation Failed',
          detail: 'The request contains invalid data',
          errors,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
      }
      return next(error);
    }
  };
};
