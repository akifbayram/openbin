import { Router, Request, Response } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const ELECTRIC_URL = process.env.ELECTRIC_URL || 'http://localhost:3000';

router.use(authenticate);

/** Verify user is a member of a home */
async function verifyHomeMembership(homeId: string, userId: string): Promise<boolean> {
  const result = await query(
    'SELECT id FROM home_members WHERE home_id = $1 AND user_id = $2',
    [homeId, userId]
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

// GET /api/shapes/bins?home_id=X — proxy bins shape for a home
router.get('/bins', async (req, res) => {
  try {
    const homeId = req.query.home_id as string;
    if (!homeId) {
      res.status(400).json({ error: 'home_id query parameter is required' });
      return;
    }

    if (!await verifyHomeMembership(homeId, req.user!.id)) {
      res.status(403).json({ error: 'Not a member of this home' });
      return;
    }

    const shapePath = `/v1/shape?table=bins&where=home_id='${homeId}'`;
    await proxyToElectric(shapePath, req, res);
  } catch (err) {
    console.error('Shape bins proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy bins shape' });
    }
  }
});

// GET /api/shapes/photos?home_id=X — proxy photos shape for a home
router.get('/photos', async (req, res) => {
  try {
    const homeId = req.query.home_id as string;
    if (!homeId) {
      res.status(400).json({ error: 'home_id query parameter is required' });
      return;
    }

    if (!await verifyHomeMembership(homeId, req.user!.id)) {
      res.status(403).json({ error: 'Not a member of this home' });
      return;
    }

    // Get all bin IDs for this home to filter photos
    const binsResult = await query('SELECT id FROM bins WHERE home_id = $1', [homeId]);
    const binIds = binsResult.rows.map(r => r.id);

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

// GET /api/shapes/homes — proxy homes shape for the user
router.get('/homes', async (req, res) => {
  try {
    // Get home IDs the user belongs to
    const memberships = await query(
      'SELECT home_id FROM home_members WHERE user_id = $1',
      [req.user!.id]
    );

    const homeIds = memberships.rows.map(r => r.home_id);

    if (homeIds.length === 0) {
      const shapePath = `/v1/shape?table=homes&where=id='00000000-0000-0000-0000-000000000000'`;
      await proxyToElectric(shapePath, req, res);
      return;
    }

    const inClause = homeIds.map(id => `'${id}'`).join(',');
    const shapePath = `/v1/shape?table=homes&where=id IN (${inClause})`;
    await proxyToElectric(shapePath, req, res);
  } catch (err) {
    console.error('Shape homes proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy homes shape' });
    }
  }
});

// GET /api/shapes/home-members?home_id=X — proxy home_members shape
router.get('/home-members', async (req, res) => {
  try {
    const homeId = req.query.home_id as string;
    if (!homeId) {
      res.status(400).json({ error: 'home_id query parameter is required' });
      return;
    }

    if (!await verifyHomeMembership(homeId, req.user!.id)) {
      res.status(403).json({ error: 'Not a member of this home' });
      return;
    }

    const shapePath = `/v1/shape?table=home_members&where=home_id='${homeId}'`;
    await proxyToElectric(shapePath, req, res);
  } catch (err) {
    console.error('Shape home-members proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy home-members shape' });
    }
  }
});

export default router;
