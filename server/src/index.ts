import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import homesRoutes from './routes/homes.js';
import binsRoutes from './routes/bins.js';
import photosRoutes from './routes/photos.js';
import shapesRoutes from './routes/shapes.js';
import exportRoutes from './routes/export.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/homes', homesRoutes);
app.use('/api/bins', binsRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/shapes', shapesRoutes);
app.use('/api', exportRoutes);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

export default app;
