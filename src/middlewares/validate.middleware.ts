import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { validateData } from '../utils/validate';
import { ValidationError } from '@/libs/errors';

type ValidationTarget = 'body' | 'query' | 'params';
export const validateRequest =
  (schema: z.ZodType, target: ValidationTarget = 'body'): RequestHandler =>
  (req, _res, next) => {
    const validationResult = validateData(schema, req[target]);
    if (!validationResult.success) {
      throw new ValidationError('Validation failed', validationResult.issues);
    }

    Object.defineProperty(req, target, {
      value: validationResult.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
