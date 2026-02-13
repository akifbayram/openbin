import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import locationsRoutes from './routes/locations.js';
import areasRoutes from './routes/areas.js';
import binsRoutes from './routes/bins.js';
import photosRoutes from './routes/photos.js';
import shapesRoutes from './routes/shapes.js';
import exportRoutes from './routes/export.js';
import tagColorsRoutes from './routes/tagColors.js';
import aiRoutes from './routes/ai.js';
import printSettingsRoutes from './routes/printSettings.js';
import activityRoutes from './routes/activity.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many registration attempts, please try again later' },
});

const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many attempts, please try again later' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many AI requests, please try again later' },
});

// Routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/locations/join', joinLimiter);
app.use('/api/locations', locationsRoutes);
app.use('/api/locations', areasRoutes);
app.use('/api/locations', activityRoutes);
app.use('/api/bins', binsRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/shapes', shapesRoutes);
app.use('/api/tag-colors', tagColorsRoutes);
app.use('/api/print-settings', printSettingsRoutes);
app.use('/api', exportRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

export default app;
