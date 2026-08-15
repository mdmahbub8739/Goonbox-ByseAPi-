import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { harvester } from './server/harvester';
import { 
  fetchByseActiveDomain, 
  addByseRemoteUploadServer, 
  checkByseRemoteStatusServer, 
  getByseFileInfoServer 
} from './server/byse';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Byse API Endpoints
  app.get('/api/byse/domain', async (req, res) => {
    try {
      const data = await fetchByseActiveDomain();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch Byse domain' });
    }
  });

  app.post('/api/byse/remote/add', async (req, res) => {
    try {
      const url = req.body?.url;
      const title = req.body?.title;
      if (!url) return res.status(400).json({ error: 'url is required' });
      const data = await addByseRemoteUploadServer(url, title);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Remote upload failed' });
    }
  });

  app.get('/api/byse/remote/status', async (req, res) => {
    try {
      const filecode = String(req.query.filecode || '');
      if (!filecode) return res.status(400).json({ error: 'filecode query param required' });
      const data = await checkByseRemoteStatusServer(filecode);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Status check failed' });
    }
  });

  app.get('/api/byse/file/info', async (req, res) => {
    try {
      const filecode = String(req.query.filecode || '');
      if (!filecode) return res.status(400).json({ error: 'filecode query param required' });
      const data = await getByseFileInfoServer(filecode);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'File info check failed' });
    }
  });

  // Harvester Status & Telemetry
  app.get('/api/harvester/status', (req, res) => {
    try {
      const data = harvester.getTelemetry();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to get status' });
    }
  });

  // 2-Step Matching Sync targeting https://pornx.to/newest
  app.post('/api/harvester/sync-newest', async (req, res) => {
    try {
      const pages = Number(req.body?.pages) || 2;
      const result = await harvester.syncNewestTwoStep(pages);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Newest sync failed' });
    }
  });

  // Manual trigger to pull latest videos immediately (calls 2-Step newest sync)
  app.post('/api/harvester/sync-latest', async (req, res) => {
    try {
      const pages = Number(req.body?.pages) || 2;
      const result = await harvester.syncNewestTwoStep(pages);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Sync failed' });
    }
  });

  // Toggle Auto-sync on/off or change interval
  app.post('/api/harvester/toggle-auto', (req, res) => {
    try {
      const enabled = req.body?.enabled !== false;
      const interval = Number(req.body?.intervalMinutes) || 3;
      harvester.setAutoSync(enabled, interval);
      res.json({ success: true, telemetry: harvester.getTelemetry() });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to toggle' });
    }
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Video streaming & Harvester server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
