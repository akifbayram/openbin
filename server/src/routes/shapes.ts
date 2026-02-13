import { Router, Request, Response } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const router = Router();
const ELECTRIC_URL = process.env.ELECTRIC_URL || 'http://localhost:3000';

router.use(authenticate);

/** Verify user is a member of a location */
async function verifyLocationMembership(locationId: string, userId: string): Promise<boolean> {
  const result = await query(
    'SELECT id FROM location_members WHERE location_id = $1 AND user_id = $2',
    [locationId, userId]
  );
  return result.rows.length > 0;
}

/** Proxy a request to Electric, forwarding query params and streaming the response */
async function proxyToElectric(electricPath: string, req: Request, res: Response): Promise<void> {
  const url = new URL(electricPath, ELECTRIC_URL);

  // Forward Electric-specific query params from the client
  for (const param of ['offset', 'handle', 'live', 'cursor', 'shape_id']) {
    const val = req.query[param];
    if (val !== undefined) {
      url.searchParams.set(param, String(val));
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
    },
  });

  // Forward status and headers
  res.status(response.status);

  const headersToForward = [
    'content-type',
    'electric-handle',
    'electric-offset',
    'electric-schema',
    'electric-up-to-date',
    'cache-control',
    'etag',
  ];

  for (const header of headersToForward) {
    const val = response.headers.get(header);
    if (val) {
      res.setHeader(header, val);
    }
  }

  if (!response.body) {
    res.end();
    return;
  }

  // Stream the response body
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } finally {
    res.end();
  }
}

// GET /api/shapes/noop — returns a valid empty shape response
router.get('/noop', async (req, res) => {
  try {
    const shapePath = `/v1/shape?table=bins&where=id='00000000-0000-0000-0000-000000000000'`;
    await proxyToElectric(shapePath, req, res);
  } catch (err) {
    console.error('Shape noop proxy error:', err);
    if (!res.headersSent) {
      res.json([]);
    }
  }
});

// GET /api/shapes/bins?location_id=X — proxy bins shape for a location
router.get('/bins', async (req, res) => {
  try {
    const locationId = req.query.location_id as string;
    if (!locationId) {
      res.status(400).json({ error: 'location_id query parameter is required' });
      return;
    }

    if (!UUID_REGEX.test(locationId)) {
      res.status(400).json({ error: 'Invalid location ID format' });
      return;
    }

    if (!await verifyLocationMembership(locationId, req.user!.id)) {
      res.status(403).json({ error: 'Not a member of this location' });
      return;
    }

    const shapePath = `/v1/shape?table=bins&where=location_id='${locationId}'`;
    await proxyToElectric(shapePath, req, res);
  } catch (err) {
    console.error('Shape bins proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy bins shape' });
    }
  }
});

// GET /api/shapes/photos?location_id=X — proxy photos shape for a location
router.get('/photos', async (req, res) => {
  try {
    const locationId = req.query.location_id as string;
    if (!locationId) {
      res.status(400).json({ error: 'location_id query parameter is required' });
      return;
    }

    if (!UUID_REGEX.test(locationId)) {
      res.status(400).json({ error: 'Invalid location ID format' });
      return;
    }

    if (!await verifyLocationMembership(locationId, req.user!.id)) {
      res.status(403).json({ error: 'Not a member of this location' });
      return;
    }

    // Get all bin IDs for this location to filter photos
    const binsResult = await query('SELECT id FROM bins WHERE location_id = $1', [locationId]);
    const binIds = binsResult.rows.map(r => r.id);

    if (!binIds.every(id => UUID_REGEX.test(id))) {
      res.status(500).json({ error: 'Invalid data format' });
      return;
    }

    if (binIds.length === 0) {
      const shapePath = `/v1/shape?table=photos&where=bin_id='00000000-0000-0000-0000-000000000000'`;
      await proxyToElectric(shapePath, req, res);
      return;
    }

    // Use Electric WHERE with IN clause
    const inClause = binIds.map(id => `'${id}'`).join(',');
    const shapePath = `/v1/shape?table=photos&where=bin_id IN (${inClause})`;
    await proxyToElectric(shapePath, req, res);
  } catch (err) {
    console.error('Shape photos proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy photos shape' });
    }
  }
});

// GET /api/shapes/locations — proxy locations shape for the user
router.get('/locations', async (req, res) => {
  try {
    // Get location IDs the user belongs to
    const memberships = await query(
      'SELECT location_id FROM location_members WHERE user_id = $1',
      [req.user!.id]
    );

    const locationIds = memberships.rows.map(r => r.location_id);

    if (!locationIds.every(id => UUID_REGEX.test(id))) {
      res.status(500).json({ error: 'Invalid data format' });
      return;
    }

    if (locationIds.length === 0) {
      const shapePath = `/v1/shape?table=locations&where=id='00000000-0000-0000-0000-000000000000'`;
      await proxyToElectric(shapePath, req, res);
      return;
    }

    const inClause = locationIds.map(id => `'${id}'`).join(',');
    const shapePath = `/v1/shape?table=locations&where=id IN (${inClause})`;
    await proxyToElectric(shapePath, req, res);
  } catch (err) {
    console.error('Shape locations proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy locations shape' });
    }
  }
});

// GET /api/shapes/tag-colors?location_id=X — proxy tag_colors shape for a location
router.get('/tag-colors', async (req, res) => {
  try {
    const locationId = req.query.location_id as string;
    if (!locationId) {
      res.status(400).json({ error: 'location_id query parameter is required' });
      return;
    }

    if (!UUID_REGEX.test(locationId)) {
      res.status(400).json({ error: 'Invalid location ID format' });
      return;
    }

    if (!await verifyLocationMembership(locationId, req.user!.id)) {
      res.status(403).json({ error: 'Not a member of this location' });
      return;
    }

    const shapePath = `/v1/shape?table=tag_colors&where=location_id='${locationId}'`;
    await proxyToElectric(shapePath, req, res);
  } catch (err) {
    console.error('Shape tag-colors proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy tag-colors shape' });
    }
  }
});

// GET /api/shapes/location-members?location_id=X — proxy location_members shape
router.get('/location-members', async (req, res) => {
  try {
    const locationId = req.query.location_id as string;
    if (!locationId) {
      res.status(400).json({ error: 'location_id query parameter is required' });
      return;
    }

    if (!UUID_REGEX.test(locationId)) {
      res.status(400).json({ error: 'Invalid location ID format' });
      return;
    }

    if (!await verifyLocationMembership(locationId, req.user!.id)) {
      res.status(403).json({ error: 'Not a member of this location' });
      return;
    }

    const shapePath = `/v1/shape?table=location_members&where=location_id='${locationId}'`;
    await proxyToElectric(shapePath, req, res);
  } catch (err) {
    console.error('Shape location-members proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy location-members shape' });
    }
  }
});

export default router;
