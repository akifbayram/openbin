import type { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestLocation, createTestUser } from '../../__tests__/helpers.js';
import { createApp } from '../../index.js';

interface BinItemResponse {
  id: string;
  name: string;
  quantity: number | null;
}

interface BinResponse {
  id: string;
  short_code: string;
  name: string;
  items: BinItemResponse[];
}

describe('POST /api/bins — preserves item quantity on create', () => {
  let app: Express;
  beforeEach(() => {
    app = createApp();
  });

  it('persists per-item quantity supplied at creation time', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);

    const res = await request(app)
      .post('/api/bins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: loc.id,
        name: 'Quantity Bin',
        items: [{ name: 'a' }, { name: 'b', quantity: 3 }],
      });

    expect(res.status).toBe(201);
    const body = res.body as BinResponse;
    expect(body.items).toHaveLength(2);

    const itemA = body.items.find((it) => it.name === 'a');
    const itemB = body.items.find((it) => it.name === 'b');
    expect(itemA).toBeDefined();
    expect(itemB).toBeDefined();
    // Item without supplied quantity should be null.
    expect(itemA!.quantity).toBeNull();
    // Item with quantity:3 must round-trip.
    expect(itemB!.quantity).toBe(3);
  });
});

describe('POST /api/bins/:id/duplicate — preserves item quantity', () => {
  let app: Express;
  beforeEach(() => {
    app = createApp();
  });

  it('copies item quantity from source bin to duplicated bin', async () => {
    const { token } = await createTestUser(app);
    const loc = await createTestLocation(app, token);

    // 1. Create the source bin with one item.
    const createRes = await request(app)
      .post('/api/bins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: loc.id,
        name: 'Source Bin',
        items: [{ name: 'widget' }],
      });
    expect(createRes.status).toBe(201);
    const source = createRes.body as BinResponse;
    expect(source.items).toHaveLength(1);
    const widgetId = source.items[0].id;

    // 2. PATCH the item quantity to 5.
    const patchRes = await request(app)
      .patch(`/api/bins/${source.id}/items/${widgetId}/quantity`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 5 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.quantity).toBe(5);

    // 3. Duplicate the source bin.
    const dupRes = await request(app)
      .post(`/api/bins/${source.id}/duplicate`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(dupRes.status).toBe(201);
    const duplicate = dupRes.body as BinResponse;
    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.items).toHaveLength(1);

    // The duplicate's matching item must preserve quantity from the source.
    const dupItem = duplicate.items.find((it) => it.name === 'widget');
    expect(dupItem).toBeDefined();
    expect(dupItem!.quantity).toBe(5);
  });
});
