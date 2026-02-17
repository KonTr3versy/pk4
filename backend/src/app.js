require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes = require('./routes/auth');
const engagementRoutes = require('./routes/engagements');
const techniqueRoutes = require('./routes/techniques');
const exportRoutes = require('./routes/export');
const attackRoutes = require('./routes/attack');
const threatActorRoutes = require('./routes/threat-actors');
const templateRoutes = require('./routes/templates');
const workflowRoutes = require('./routes/workflow');
const approvalRoutes = require('./routes/approvals');
const documentRoutes = require('./routes/documents');
const actionItemRoutes = require('./routes/action-items');
const analyticsRoutes = require('./routes/analytics');
const threatPipelineRoutes = require('./routes/threat-pipeline');
const adminAttackRoutes = require('./routes/admin-attack');
const adminRoutes = require('./routes/admin');
const packsRoutes = require('./routes/packs');
const orgRoutes = require('./routes/orgs');

const { requireAuth } = require('./middleware/auth');
const db = require('./db/connection');

const app = express();

const isProduction = process.env.NODE_ENV === 'production';
const rawAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS || '';
const allowedOrigins = rawAllowedOrigins
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(helmet({
  contentSecurityPolicy: isProduction
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: [],
        },
      }
    : false,
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (!isProduction) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
}));

const createAuthRateLimiter = () => {
  const windowMs = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10);
  const max = parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10);
  const maxTrackedIps = parseInt(process.env.AUTH_RATE_LIMIT_MAX_TRACKED_IPS || '5000', 10);
  const attempts = new Map();

  function cleanup(now) {
    for (const [ip, state] of attempts.entries()) {
      if (now > state.resetAt) {
        attempts.delete(ip);
      }
    }

    while (attempts.size > maxTrackedIps) {
      const oldestKey = attempts.keys().next().value;
      if (!oldestKey) break;
      attempts.delete(oldestKey);
    }
  }

  return (req, res, next) => {
    const now = Date.now();
    cleanup(now);

    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const current = attempts.get(key);

    if (!current || now > current.resetAt) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= max) {
      return res.status(429).json({
        error: 'Too many authentication attempts. Please try again later.'
      });
    }

    current.count += 1;
    return next();
  };
};

const authRateLimiter = createAuthRateLimiter();

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

app.get('/healthz', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.get('/api/healthz', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/engagements', requireAuth, engagementRoutes);
app.use('/api/techniques', requireAuth, techniqueRoutes);
app.use('/api/export', requireAuth, exportRoutes);
app.use('/api/attack', requireAuth, attackRoutes);
app.use('/api/threat-actors', requireAuth, threatActorRoutes);
app.use('/api/templates', requireAuth, templateRoutes);
app.use('/api/workflow', requireAuth, workflowRoutes);
app.use('/api/approvals', requireAuth, approvalRoutes);
app.use('/api/documents', requireAuth, documentRoutes);
app.use('/api/action-items', requireAuth, actionItemRoutes);
app.use('/api/analytics', requireAuth, analyticsRoutes);
app.use('/api/threat-pipeline', requireAuth, threatPipelineRoutes);
app.use('/api/admin/attack', requireAuth, adminAttackRoutes);
app.use('/api/admin', requireAuth, adminRoutes);
app.use('/api/packs', requireAuth, packsRoutes);
app.use('/api/orgs', requireAuth, orgRoutes);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));

  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
    }
  });
}

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;
