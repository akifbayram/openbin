import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/binAccess.js', () => ({
  getMemberRole: vi.fn(),
  isLocationAdmin: vi.fn(),
  verifyLocationMembership: vi.fn(),
}));

import { getMemberRole } from '../../lib/binAccess.js';
import { requireLocationMemberOrAbove } from '../locationAccess.js';

function makeReq(userId?: string, locationId?: string): Request {
  return {
    user: userId ? { id: userId } : undefined,
    params: {},
    body: locationId ? { locationId } : {},
    query: {},
  } as unknown as Request;
}

function makeRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('requireLocationMemberOrAbove', () => {
  beforeEach(() => {
    vi.mocked(getMemberRole).mockReset();
  });

  it('rejects viewers with 403 FORBIDDEN', async () => {
    vi.mocked(getMemberRole).mockResolvedValue('viewer');
    const middleware = requireLocationMemberOrAbove();
    const req = makeReq('user-1', 'loc-1');
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'FORBIDDEN' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows members through to next()', async () => {
    vi.mocked(getMemberRole).mockResolvedValue('member');
    const middleware = requireLocationMemberOrAbove();
    const req = makeReq('user-1', 'loc-1');
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows admins through to next()', async () => {
    vi.mocked(getMemberRole).mockResolvedValue('admin');
    const middleware = requireLocationMemberOrAbove();
    const req = makeReq('user-1', 'loc-1');
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects non-members with 403 FORBIDDEN', async () => {
    vi.mocked(getMemberRole).mockResolvedValue(null);
    const middleware = requireLocationMemberOrAbove();
    const req = makeReq('user-1', 'loc-1');
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects requests without locationId with 400', async () => {
    const middleware = requireLocationMemberOrAbove();
    const req = makeReq('user-1', undefined);
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const middleware = requireLocationMemberOrAbove();
    const req = makeReq(undefined, 'loc-1');
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
