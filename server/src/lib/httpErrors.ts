// CheckoutAction lives in planGate.ts. We re-declare the structural shape
// here (instead of importing the alias) to keep this module dependency-free
// for non-billing call sites — httpErrors is loaded by routes that don't
// otherwise care about the plan layer.
export interface CheckoutActionShape {
  url: string;
  method: 'GET' | 'POST';
  fields: Record<string, string>;
}

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

export class QuotaExceededError extends HttpError {
  constructor(code: string, message: string) {
    super(413, code, message);
    this.name = 'QuotaExceededError';
  }
}

export class PlanRestrictedError extends HttpError {
  public readonly upgradeUrl: string | null;
  public readonly upgradeAction: CheckoutActionShape | null;
  constructor(
    message: string,
    upgradeUrl: string | null = null,
    upgradeAction: CheckoutActionShape | null = null,
  ) {
    super(403, 'PLAN_RESTRICTED', message);
    this.name = 'PlanRestrictedError';
    this.upgradeUrl = upgradeUrl;
    this.upgradeAction = upgradeAction;
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
  public readonly upgradeAction: CheckoutActionShape | null;
  constructor(
    message: string,
    upgradeUrl: string | null = null,
    upgradeAction: CheckoutActionShape | null = null,
  ) {
    super(403, 'OVER_LIMIT', message);
    this.name = 'OverLimitError';
    this.upgradeUrl = upgradeUrl;
    this.upgradeAction = upgradeAction;
  }
}

export class ReorganizeBinLimitError extends HttpError {
  public readonly limit: number;
  public readonly selected: number;
  constructor(limit: number, selected: number) {
    super(
      403,
      'REORGANIZE_BIN_LIMIT_EXCEEDED',
      `Reorganize is limited to ${limit} bins per run on your plan. You selected ${selected}.`,
    );
    this.name = 'ReorganizeBinLimitError';
    this.limit = limit;
    this.selected = selected;
  }
}

export class SelectionTooLargeError extends HttpError {
  public readonly max: number;
  public readonly requested: number;
  constructor(max: number, requested: number) {
    super(422, 'SELECTION_TOO_LARGE', `Selection of ${requested} exceeds maximum of ${max} per request`);
    this.name = 'SelectionTooLargeError';
    this.max = max;
    this.requested = requested;
  }
}
