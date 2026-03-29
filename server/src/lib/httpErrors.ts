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

export class GoneError extends HttpError {
  constructor(message: string) {
    super(410, 'GONE', message);
    this.name = 'GoneError';
  }
}

export class QuotaExceededError extends HttpError {
  constructor(code: string, message: string) {
    super(413, code, message);
    this.name = 'QuotaExceededError';
  }
}

export class PlanRestrictedError extends HttpError {
  public readonly upgradeUrl: string | null;
  constructor(message: string, upgradeUrl: string | null = null) {
    super(403, 'PLAN_RESTRICTED', message);
    this.name = 'PlanRestrictedError';
    this.upgradeUrl = upgradeUrl;
  }
}

export class MalwareDetectedError extends HttpError {
  constructor(message: string) {
    super(422, 'MALWARE_DETECTED', message);
    this.name = 'MalwareDetectedError';
  }
}

export class ScanUnavailableError extends HttpError {
  constructor(message: string) {
    super(503, 'SCAN_UNAVAILABLE', message);
    this.name = 'ScanUnavailableError';
  }
}

export class OverLimitError extends HttpError {
  public readonly upgradeUrl: string | null;
  constructor(message: string, upgradeUrl: string | null = null) {
    super(403, 'OVER_LIMIT', message);
    this.name = 'OverLimitError';
    this.upgradeUrl = upgradeUrl;
  }
}
