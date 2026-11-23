import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { app } from './src/server/app.js';
import { db } from './src/server/db.js';
import { normalizeYouTubeEmbedUrl } from './src/server/video.js';

export { normalizeYouTubeEmbedUrl };

const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx !== -1 ? process.argv[portArgIdx + 1] : undefined;
const PORT = cliPort || process.env.PORT || 3000;

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api/')) return next();
      try {
        const indexPath = path.resolve('index.html');
        if (fs.existsSync(indexPath)) {
          let template = fs.readFileSync(indexPath, 'utf-8');
          template = await vite.transformIndexHtml(req.originalUrl, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
          return;
        }
        next();
      } catch (e) {
        next(e);
      }
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(
      `1 Million Naira Skill Challenge server active on port ${PORT} (${
        db.isSupabaseEnabled() ? 'Supabase PostgreSQL' : 'Local dev storage'
      })`
    );
  });
}

export default app;
export { app };

if (!process.env.VERCEL) {
  startServer();
}
