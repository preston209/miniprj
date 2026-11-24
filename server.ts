import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './server/config/db.ts';
import apiRoutes from './server/routes/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Attempt initial MongoDB connection cleanly without crashing startup if env secret isn't set yet
  if (process.env.MONGODB_URI) {
    try {
      await connectDB();
      console.log('[Server] MongoDB Atlas connected.');
    } catch (err) {
      console.warn(
        '[Server] Initial MongoDB connection deferred:',
        err instanceof Error ? err.message : 'unreachable'
      );
    }
  } else {
    console.warn('[Server] MONGODB_URI not set yet; API routes will return 503 until configured.');
  }

  // RESTful API routes
  app.use('/api', apiRoutes);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] HavenStay PG server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
