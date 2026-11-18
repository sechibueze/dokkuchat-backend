export class HttpError extends Error {
  readonly isOperational: boolean;

  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly details?: unknown,
    options?: { cause?: unknown; isOperational?: boolean },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.isOperational = options?.isOperational ?? true;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Authentication required', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends HttpError {
  constructor(
    message = 'You do not have permission to perform this action',
    details?: unknown,
  ) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Resource already exists', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class ValidationError extends HttpError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = 'Too many requests', details?: unknown) {
    super(message, 429, 'TOO_MANY_REQUESTS', details);
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal server error', cause?: unknown) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', undefined, {
      cause,
      isOperational: false,
    });
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message = 'Service unavailable', details?: unknown) {
    super(message, 503, 'SERVICE_UNAVAILABLE', details);
  }
}
