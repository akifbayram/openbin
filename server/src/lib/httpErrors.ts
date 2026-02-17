export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class ValidationError extends HttpError {
  constructor(message: string) {
    super(422, 'VALIDATION_ERROR', message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends HttpError {
  constructor(message: string) {
    super(403, 'FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message: string) {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}
