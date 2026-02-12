import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import locationsRoutes from './routes/locations.js';
import areasRoutes from './routes/areas.js';
import binsRoutes from './routes/bins.js';
import photosRoutes from './routes/photos.js';
import shapesRoutes from './routes/shapes.js';
import exportRoutes from './routes/export.js';
import tagColorsRoutes from './routes/tagColors.js';
import aiRoutes from './routes/ai.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/locations', areasRoutes);
app.use('/api/bins', binsRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/shapes', shapesRoutes);
app.use('/api/tag-colors', tagColorsRoutes);
app.use('/api', exportRoutes);
app.use('/api/ai', aiRoutes);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

export default app;
