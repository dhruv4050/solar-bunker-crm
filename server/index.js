import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabaseHealth, getCampaigns, isSupabaseConfigured } from './db.js';
import webhookRouter from './routes/webhook.js';
import leadsRouter from './routes/leads.js';
import usersRouter from './routes/users.js';
import { authenticateUser, requireRole } from './middleware/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Configurable CORS Whitelist (allows dev servers and Google Apps Script server-to-server requests)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://localhost:3001'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (Google Apps Script, curl, server-to-server webhooks)
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CRM-API-KEY', 'x-crm-api-key'],
  credentials: true
}));

// Sanitize payload limit to prevent memory exhaustion attacks
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

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
app.use('/api', usersRouter);
app.use('/api/webhooks', webhookRouter);
// Also support alias /api/leads/webhook for convenience
app.use('/api/leads/webhook', webhookRouter);
app.use('/api/leads', leadsRouter);

// GET /api/config - Public configuration for frontend Supabase client initialization
app.get('/api/config', (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://muqrumruisowcvllxaeo.supabase.co';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cXJ1bXJ1aXNvd2N2bGx4YWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTI0MDAsImV4cCI6MjEwNzAyODQwMH0.MgNLazO5Ht9yuJ_6SsnfFQVt7HKTY5B81ejGAF2QHZY';
  res.json({
    success: true,
    supabaseUrl,
    supabaseAnonKey
  });
});

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

// GET /api/campaigns - List all recognized campaigns/sheet tabs from Supabase (Protected: Admin & Caller)
app.get('/api/campaigns', authenticateUser, requireRole('admin', 'caller'), async (req, res) => {
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
