import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabaseHealth, getCampaigns, isSupabaseConfigured } from './db.js';
import webhookRouter from './routes/webhook.js';
import leadsRouter from './routes/leads.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CRM-API-KEY', 'x-crm-api-key']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.startsWith('/api/health') && !req.path.startsWith('/api/webhooks/leads/health')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Mount Routes
app.use('/api/webhooks', webhookRouter);
// Also support alias /api/leads/webhook for convenience
app.use('/api/leads/webhook', webhookRouter);
app.use('/api/leads', leadsRouter);

// GET /api/health - Comprehensive System & Supabase Database Health Check
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await getDatabaseHealth();
    res.status(dbHealth.connected ? 200 : 503).json({
      status: dbHealth.connected ? 'healthy' : 'unhealthy',
      service: 'Solar Bunker CRM Backend API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      provider: dbHealth.provider,
      connected: dbHealth.connected,
      database: dbHealth.database,
      config: {
        supabaseConfigured: isSupabaseConfigured,
        apiKeyConfigured: Boolean(process.env.CRM_API_KEY)
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// GET /api/campaigns - List all recognized campaigns/sheet tabs from Supabase
app.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await getCampaigns();
    res.json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve Vite production build static assets if dist exists
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback for Single Page Application (SPA) routing in Express
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) next();
    });
  }
  next();
});

// Start Server
app.listen(PORT, () => {
  const publicUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
  console.log(`\n======================================================`);
  console.log(`🚀 Solar Bunker CRM Backend Server Active`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🗄️ Database: Supabase PostgreSQL (Cloud authoritative)`);
  console.log(`🔗 Local Webhook URL:  http://localhost:${PORT}/api/webhooks/leads`);
  console.log(`🌐 Public Webhook URL: ${publicUrl}/api/webhooks/leads`);
  console.log(`🔑 Webhook Header:     X-CRM-API-KEY`);
  console.log(`======================================================\n`);
});

export default app;
