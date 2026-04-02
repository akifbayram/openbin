import type { Express } from 'express';
import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../index.js';
import { createTestArea, createTestBin, createTestLocation, createTestUser } from './helpers.js';

let app: Express;

beforeEach(() => {
  app = createApp();
});

// ---------------------------------------------------------------------------
// JSON Export
// ---------------------------------------------------------------------------

describe('GET /api/locations/:id/export', () => {
  it('exports V2 JSON with bins, tags, and areas', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const area = await createTestArea(app, token, location.id, 'Garage');
    await request(app)
      .post('/api/bins')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id, name: 'Toolbox', items: ['Hammer', 'Wrench'], tags: ['tools'], areaId: area.id });

    const res = await request(app)
      .get(`/api/locations/${location.id}/export`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
    expect(res.body.bins).toHaveLength(1);
    expect(res.body.bins[0].name).toBe('Toolbox');
    expect(res.body.bins[0].items).toHaveLength(2);
    expect(res.body.bins[0].tags).toEqual(['tools']);
    expect(res.body.locationName).toBe(location.name);
    expect(res.body.areas).toBeDefined();
  });

  it('exports empty location', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .get(`/api/locations/${location.id}/export`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
    expect(res.body.bins).toHaveLength(0);
  });

  it('returns 403 for non-member', async () => {
    const { token: ownerToken } = await createTestUser(app);
    const location = await createTestLocation(app, ownerToken);
    const { token: otherToken } = await createTestUser(app);

    const res = await request(app)
      .get(`/api/locations/${location.id}/export`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent location', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .get('/api/locations/nonexistent/export')
      .set('Authorization', `Bearer ${token}`);

    // requireLocationMember middleware returns 403 before 404 check
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

describe('GET /api/locations/:id/export/csv', () => {
  it('returns CSV with correct header and one row per item', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    await request(app)
      .post('/api/bins')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id, name: 'Cables', items: ['HDMI', 'USB-C'], tags: ['tech'] });

    const res = await request(app)
      .get(`/api/locations/${location.id}/export/csv`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.split('\n');
    expect(lines[0]).toBe('Bin Name,Area,Item,Quantity,Tags');
    // Two items = two rows
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[1]).toContain('Cables');
    expect(lines[1]).toContain('HDMI');
  });

  it('includes area paths in CSV', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const area = await createTestArea(app, token, location.id, 'Shelf A');
    await request(app)
      .post('/api/bins')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id, name: 'Books', items: ['Novel'], areaId: area.id });

    const res = await request(app)
      .get(`/api/locations/${location.id}/export/csv`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const lines = res.text.split('\n');
    expect(lines[1]).toContain('Shelf A');
  });

  it('handles bins with no items', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    await request(app)
      .post('/api/bins')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id, name: 'EmptyBin', items: [] });

    const res = await request(app)
      .get(`/api/locations/${location.id}/export/csv`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const lines = res.text.split('\n').filter(Boolean);
    expect(lines).toHaveLength(2); // header + 1 empty row
    expect(lines[1]).toContain('EmptyBin');
  });
});

// ---------------------------------------------------------------------------
// JSON Import
// ---------------------------------------------------------------------------

describe('POST /api/locations/:id/import', () => {
  it('imports bins in merge mode', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post(`/api/locations/${location.id}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bins: [
          { id: 'abc123', name: 'Box A', items: ['Tape', 'Glue'], notes: '', tags: ['craft'], icon: '', color: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), photos: [] },
          { id: 'def456', name: 'Box B', items: ['Pen'], notes: '', tags: [], icon: '', color: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), photos: [] },
        ],
        mode: 'merge',
      });

    expect(res.status).toBe(200);
    expect(res.body.binsImported).toBe(2);
    expect(res.body.binsSkipped).toBe(0);
  });

  it('skips existing bins in merge mode', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    const bin = await createTestBin(app, token, location.id, { name: 'Existing' });

    // Merge mode now checks by shortCode within location, not by id
    const res = await request(app)
      .post(`/api/locations/${location.id}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bins: [
          { id: 'ignored-uuid', shortCode: bin.short_code, name: 'Existing', items: [], notes: '', tags: [], icon: '', color: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), photos: [] },
        ],
        mode: 'merge',
      });

    expect(res.status).toBe(200);
    expect(res.body.binsImported).toBe(0);
    expect(res.body.binsSkipped).toBe(1);
  });

  it('replaces existing bins in replace mode', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    await createTestBin(app, token, location.id, { name: 'OldBin' });

    const res = await request(app)
      .post(`/api/locations/${location.id}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bins: [
          { id: 'new111', name: 'NewBin', items: [], notes: '', tags: [], icon: '', color: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), photos: [] },
        ],
        mode: 'replace',
      });

    expect(res.status).toBe(200);
    expect(res.body.binsImported).toBe(1);

    // Verify old bin is gone
    const listRes = await request(app)
      .get(`/api/bins?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.results).toHaveLength(1);
    expect(listRes.body.results[0].name).toBe('NewBin');
  });

  it('returns dry-run preview without creating bins', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post(`/api/locations/${location.id}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bins: [
          { id: 'dry001', name: 'DryBin', items: ['item1'], notes: '', tags: [], icon: '', color: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), photos: [] },
        ],
        mode: 'merge',
        dryRun: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.preview).toBe(true);
    expect(res.body.toCreate).toHaveLength(1);
    expect(res.body.totalBins).toBe(1);

    // Verify no bins were actually created
    const listRes = await request(app)
      .get(`/api/bins?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.results).toHaveLength(0);
  });

  it('returns 422 for missing bins array', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post(`/api/locations/${location.id}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'merge' });

    expect(res.status).toBe(422);
  });

  it('returns 422 for too many bins', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const bins = Array.from({ length: 2001 }, (_, i) => ({
      id: `x${String(i).padStart(5, '0')}`,
      name: `Bin ${i}`,
      items: [],
      notes: '',
      tags: [],
      icon: '',
      color: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      photos: [],
    }));

    const res = await request(app)
      .post(`/api/locations/${location.id}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ bins, mode: 'merge' });

    expect(res.status).toBe(422);
  });

  it('imports with areas creating hierarchy', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post(`/api/locations/${location.id}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bins: [
          { id: 'area01', name: 'Drill', items: ['Bit'], notes: '', tags: [], icon: '', color: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), photos: [] },
        ],
        areas: [
          { path: 'Garage' },
          { path: 'Garage / Shelf A' },
        ],
        mode: 'merge',
      });

    expect(res.status).toBe(200);
    expect(res.body.binsImported).toBe(1);

    // Verify areas were created
    const areasRes = await request(app)
      .get(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`);
    const areaNames = areasRes.body.results.map((a: { name: string }) => a.name);
    expect(areaNames).toContain('Garage');
    expect(areaNames).toContain('Shelf A');

    // Verify hierarchy: Shelf A should have Garage as parent
    const shelfA = areasRes.body.results.find((a: { name: string }) => a.name === 'Shelf A');
    const garage = areasRes.body.results.find((a: { name: string }) => a.name === 'Garage');
    expect(shelfA.parent_id).toBe(garage.id);
  });

  it('imports with custom field definitions and maps values to bins', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post(`/api/locations/${location.id}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bins: [
          { id: 'cf0001', name: 'PaintCan', items: ['Brush'], notes: '', tags: [], icon: '', color: '', customFields: { Color: 'Red', Size: 'Large' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), photos: [] },
        ],
        customFieldDefinitions: [
          { name: 'Color', position: 0 },
          { name: 'Size', position: 1 },
        ],
        mode: 'merge',
      });

    expect(res.status).toBe(200);
    expect(res.body.binsImported).toBe(1);

    // Verify custom field definitions were created
    const cfRes = await request(app)
      .get(`/api/locations/${location.id}/custom-fields`)
      .set('Authorization', `Bearer ${token}`);
    const fieldNames = cfRes.body.results.map((f: { name: string }) => f.name);
    expect(fieldNames).toContain('Color');
    expect(fieldNames).toContain('Size');

    // Verify bin has custom field values mapped by ID
    const binsRes = await request(app)
      .get(`/api/bins?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);
    const bin = binsRes.body.results.find((b: { name: string }) => b.name === 'PaintCan');
    const colorField = cfRes.body.results.find((f: { name: string }) => f.name === 'Color');
    const sizeField = cfRes.body.results.find((f: { name: string }) => f.name === 'Size');
    expect(bin.custom_fields[colorField.id]).toBe('Red');
    expect(bin.custom_fields[sizeField.id]).toBe('Large');
  });

  it('dry-run preview includes area count', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post(`/api/locations/${location.id}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bins: [
          { id: 'dry002', name: 'DryBin2', items: [], notes: '', tags: [], icon: '', color: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), photos: [] },
        ],
        areas: [
          { path: 'Workshop' },
          { path: 'Workshop / Bench' },
          { path: 'Attic' },
        ],
        mode: 'merge',
        dryRun: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.preview).toBe(true);
    expect(res.body.totalBins).toBe(1);

    // Verify no areas were actually created (dry-run should not mutate)
    const areasRes = await request(app)
      .get(`/api/locations/${location.id}/areas`)
      .set('Authorization', `Bearer ${token}`);
    expect(areasRes.body.results).toHaveLength(0);
  });

  it('imports tag colors alongside bins', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post(`/api/locations/${location.id}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        bins: [
          { id: 'tag001', name: 'Tagged', items: [], notes: '', tags: ['urgent'], icon: '', color: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), photos: [] },
        ],
        mode: 'merge',
        tagColors: [{ tag: 'urgent', color: '#ff0000' }],
      });

    expect(res.status).toBe(200);
    expect(res.body.binsImported).toBe(1);

    // Verify tag color was imported
    const tcRes = await request(app)
      .get(`/api/tag-colors?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(tcRes.body.results.some((tc: { tag: string }) => tc.tag === 'urgent')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CSV Import
// ---------------------------------------------------------------------------

describe('POST /api/locations/:id/import/csv', () => {
  it('imports round-trip CSV format', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const csv = 'Bin Name,Area,Item,Quantity,Tags\nToolkit,,Hammer,2,tools\nToolkit,,Saw,,tools\n';

    const res = await request(app)
      .post(`/api/locations/${location.id}/import/csv`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(csv), 'import.csv');

    expect(res.status).toBe(200);
    expect(res.body.binsImported).toBe(1);
    expect(res.body.itemsImported).toBe(2);
  });

  it('imports one-bin-per-row CSV format', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const csv = 'Bin Name,Area,Items,Tags\nBox A,,Tape;Glue,craft\nBox B,,Pen x 3,office\n';

    const res = await request(app)
      .post(`/api/locations/${location.id}/import/csv`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(csv), 'import.csv');

    expect(res.status).toBe(200);
    expect(res.body.binsImported).toBe(2);
  });

  it('returns dry-run preview for CSV', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const csv = 'Bin Name,Area,Item,Quantity,Tags\nBox,,Item1,,\n';

    const res = await request(app)
      .post(`/api/locations/${location.id}/import/csv`)
      .set('Authorization', `Bearer ${token}`)
      .field('dryRun', 'true')
      .attach('file', Buffer.from(csv), 'import.csv');

    expect(res.status).toBe(200);
    expect(res.body.preview).toBe(true);
    expect(res.body.toCreate).toHaveLength(1);
  });

  it('returns 422 for invalid CSV headers', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const csv = 'Name,Description\nBox,Something\n';

    const res = await request(app)
      .post(`/api/locations/${location.id}/import/csv`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(csv), 'import.csv');

    expect(res.status).toBe(422);
  });

  it('returns 422 when no file uploaded', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post(`/api/locations/${location.id}/import/csv`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// ZIP Import
// ---------------------------------------------------------------------------

function buildTestZip(bins: unknown[], manifest?: Record<string, unknown>): Buffer {
  return Buffer.from(zipSync({
    'manifest.json': strToU8(JSON.stringify({
      format: 'openbin-zip',
      version: 3,
      exportedAt: new Date().toISOString(),
      locationName: 'Test',
      binCount: bins.length,
      ...manifest,
    })),
    'bins.json': strToU8(JSON.stringify(bins)),
  }));
}

describe('POST /api/locations/:id/import/zip', () => {
  it('imports bins from ZIP', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const zipBuf = await buildTestZip([
      { name: 'ZipBin1', items: ['Widget'], tags: ['import'], notes: '', icon: '', color: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { name: 'ZipBin2', items: [], tags: [], notes: '', icon: '', color: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);

    const res = await request(app)
      .post(`/api/locations/${location.id}/import/zip`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', zipBuf, 'export.zip');

    expect(res.status).toBe(200);
    expect(res.body.binsImported).toBe(2);
  });

  it('returns 422 for ZIP without manifest', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const buf = Buffer.from(zipSync({ 'bins.json': strToU8('[]') }));

    const res = await request(app)
      .post(`/api/locations/${location.id}/import/zip`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buf, 'export.zip');

    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid manifest format', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const buf = Buffer.from(zipSync({
      'manifest.json': strToU8(JSON.stringify({ format: 'wrong' })),
      'bins.json': strToU8('[]'),
    }));

    const res = await request(app)
      .post(`/api/locations/${location.id}/import/zip`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buf, 'export.zip');

    expect(res.status).toBe(422);
  });

  it('returns dry-run preview for ZIP', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const zipBuf = await buildTestZip([{ id: 'z00001', name: 'DryZip', items: ['x'] }]);

    const res = await request(app)
      .post(`/api/locations/${location.id}/import/zip`)
      .set('Authorization', `Bearer ${token}`)
      .field('dryRun', 'true')
      .attach('file', zipBuf, 'export.zip');

    expect(res.status).toBe(200);
    expect(res.body.preview).toBe(true);
    expect(res.body.toCreate).toHaveLength(1);
  });

  it('replace mode clears existing bins', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);
    await createTestBin(app, token, location.id, { name: 'OldBin' });

    const zipBuf = await buildTestZip([
      { name: 'NewZipBin', items: [], tags: [], notes: '', icon: '', color: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);

    const res = await request(app)
      .post(`/api/locations/${location.id}/import/zip`)
      .set('Authorization', `Bearer ${token}`)
      .field('mode', 'replace')
      .attach('file', zipBuf, 'export.zip');

    expect(res.status).toBe(200);
    expect(res.body.binsImported).toBe(1);

    const listRes = await request(app)
      .get(`/api/bins?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.results).toHaveLength(1);
    expect(listRes.body.results[0].name).toBe('NewZipBin');
  });
});

// ---------------------------------------------------------------------------
// Legacy Import
// ---------------------------------------------------------------------------

describe('POST /api/import/legacy', () => {
  it('imports legacy V1 data with contents string', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post('/api/import/legacy')
      .set('Authorization', `Bearer ${token}`)
      .send({
        locationId: location.id,
        data: {
          bins: [
            { name: 'LegacyBin', contents: 'Item A\nItem B\nItem C', tags: ['old'] },
          ],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);

    // Verify items were created from contents
    const listRes = await request(app)
      .get(`/api/bins?location_id=${location.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.results).toHaveLength(1);
  });

  it('returns 422 for missing locationId', async () => {
    const { token } = await createTestUser(app);

    const res = await request(app)
      .post('/api/import/legacy')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: { bins: [] } });

    expect(res.status).toBe(422);
  });

  it('returns 422 for missing data', async () => {
    const { token } = await createTestUser(app);
    const location = await createTestLocation(app, token);

    const res = await request(app)
      .post('/api/import/legacy')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: location.id });

    expect(res.status).toBe(422);
  });
});
