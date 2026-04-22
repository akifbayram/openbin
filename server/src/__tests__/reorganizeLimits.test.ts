import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/config.js', () => ({
  config: {
    selfHosted: false,
    planLimits: {
      plusReorganizeMaxBins: 10 as number | null,
      proReorganizeMaxBins: 40 as number | null,
    },
  },
}));

vi.mock('../db.js', () => ({
  query: vi.fn(),
}));

import { config } from '../lib/config.js';
import { ReorganizeBinLimitError } from '../lib/httpErrors.js';
import { assertReorganizeBinLimit, Plan, type UserPlanInfo } from '../lib/planGate.js';

const plusHint: UserPlanInfo = {
  plan: Plan.PLUS,
  subStatus: 1,
  activeUntil: null,
  email: 'plus@example.com',
  previousSubStatus: null,
};

const proHint: UserPlanInfo = {
  plan: Plan.PRO,
  subStatus: 1,
  activeUntil: null,
  email: 'pro@example.com',
  previousSubStatus: null,
};

describe('assertReorganizeBinLimit', () => {
  beforeEach(() => {
    Object.assign(config, { selfHosted: false });
    Object.assign(config.planLimits, { plusReorganizeMaxBins: 10, proReorganizeMaxBins: 40 });
  });

  it('passes immediately for self-hosted regardless of count', async () => {
    Object.assign(config, { selfHosted: true });
    await expect(assertReorganizeBinLimit('u-1', 1000, plusHint)).resolves.toBeUndefined();
  });

  it('passes when input count equals the Plus cap', async () => {
    await expect(assertReorganizeBinLimit('u-1', 10, plusHint)).resolves.toBeUndefined();
  });

  it('passes when input count is below the Plus cap', async () => {
    await expect(assertReorganizeBinLimit('u-1', 5, plusHint)).resolves.toBeUndefined();
  });

  it('passes when plan has null cap (unlimited)', async () => {
    Object.assign(config.planLimits, { proReorganizeMaxBins: null });
    await expect(assertReorganizeBinLimit('u-1', 1000, proHint)).resolves.toBeUndefined();
  });

  it('throws ReorganizeBinLimitError when exceeding Plus cap', async () => {
    const err = await assertReorganizeBinLimit('u-1', 15, plusHint).catch((e) => e);
    expect(err).toBeInstanceOf(ReorganizeBinLimitError);
    expect((err as ReorganizeBinLimitError).statusCode).toBe(403);
    expect((err as ReorganizeBinLimitError).code).toBe('REORGANIZE_BIN_LIMIT_EXCEEDED');
    expect((err as ReorganizeBinLimitError).limit).toBe(10);
    expect((err as ReorganizeBinLimitError).selected).toBe(15);
    expect((err as ReorganizeBinLimitError).message).toMatch(/10 bins/);
    expect((err as ReorganizeBinLimitError).message).toMatch(/15/);
  });

  it('throws ReorganizeBinLimitError when exceeding Pro cap', async () => {
    const err = await assertReorganizeBinLimit('u-1', 41, proHint).catch((e) => e);
    expect(err).toBeInstanceOf(ReorganizeBinLimitError);
    expect((err as ReorganizeBinLimitError).limit).toBe(40);
    expect((err as ReorganizeBinLimitError).selected).toBe(41);
  });
});
