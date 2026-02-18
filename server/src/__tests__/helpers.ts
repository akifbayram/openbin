import type { Express } from 'express';
import request from 'supertest';

let userCounter = 0;

export async function createTestUser(app: Express, overrides?: { username?: string; password?: string }) {
  userCounter++;
  const username = overrides?.username ?? `testuser${userCounter}_${Date.now()}`;
  const password = overrides?.password ?? 'TestPass123!';

  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, password });

  return {
    token: res.body.token as string,
    user: res.body.user as { id: string; username: string; displayName: string },
    password,
  };
}

export async function createTestLocation(app: Express, token: string, name?: string) {
  const res = await request(app)
    .post('/api/locations')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: name ?? `Test Location ${Date.now()}` });

  return res.body as {
    id: string;
    name: string;
    invite_code: string;
    role: string;
    member_count: number;
  };
}

export async function createTestBin(
  app: Express,
  token: string,
  locationId: string,
  overrides?: { name?: string; items?: string[]; tags?: string[]; notes?: string },
) {
  const res = await request(app)
    .post('/api/bins')
    .set('Authorization', `Bearer ${token}`)
    .send({
      locationId,
      name: overrides?.name ?? `Test Bin ${Date.now()}`,
      items: overrides?.items,
      tags: overrides?.tags,
      notes: overrides?.notes,
    });

  return res.body as {
    id: string;
    name: string;
    short_code: string;
    location_id: string;
    tags: string[];
    notes: string;
  };
}

export async function createTestArea(app: Express, token: string, locationId: string, name?: string) {
  const res = await request(app)
    .post(`/api/locations/${locationId}/areas`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: name ?? `Test Area ${Date.now()}` });

  return res.body as {
    id: string;
    name: string;
    location_id: string;
  };
}
