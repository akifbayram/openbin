import type { Express } from 'express';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestBin, createTestLocation, createTestUser } from '../../__tests__/helpers.js';
import { createApp } from '../../index.js';
import { resolveBinCode } from '../resolveBinCode.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe('resolveBinCode', () => {
  it('resolves a short code to its UUID within the location', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, loc.id);

    const uuid = await resolveBinCode(loc.id, bin.short_code);
    expect(uuid).toBe(bin.id);
  });

  it('matches case-insensitively', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, loc.id);

    const uuid = await resolveBinCode(loc.id, bin.short_code.toLowerCase());
    expect(uuid).toBe(bin.id);
  });

  it('returns null when no bin matches the code in the location', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);

    const uuid = await resolveBinCode(loc.id, 'ZZZZZZ');
    expect(uuid).toBeNull();
  });

  it('isolates lookups by location', async () => {
    const { token } = await createTestUser(app);
    const locA = await createTestLocation(app, token, 'Location A');
    const locB = await createTestLocation(app, token, 'Location B');
    const binA = await createTestBin(app, token, locA.id);

    const hit = await resolveBinCode(locA.id, binA.short_code);
    const miss = await resolveBinCode(locB.id, binA.short_code);

    expect(hit).toBe(binA.id);
    expect(miss).toBeNull();
  });
});
