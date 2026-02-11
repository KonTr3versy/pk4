/**
 * PurpleKit Backend Server
 * 
 * This is the main entry point for the API server.
 * It sets up Express, middleware, routes, and starts listening.
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// Import route handlers
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

// Import middleware
const { requireAuth } = require('./middleware/auth');

// Import database connection
const db = require('./db/connection');

// Create Express app
const app = express();

// =============================================================================
// MIDDLEWARE
// =============================================================================
// Middleware are functions that run on every request before your route handlers.
// They can modify the request, add security headers, parse JSON, etc.

// Security headers (protects against common web vulnerabilities)
app.use(helmet({
  contentSecurityPolicy: false, // Disable for now since we're serving React
}));

// Enable CORS (allows frontend to talk to backend)
// In production, you'd restrict this to your domain
app.use(cors());

// Parse JSON request bodies
// This allows us to read JSON data sent from the frontend
app.use(express.json());

// Log all requests (helpful for debugging)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// =============================================================================
// API ROUTES
// =============================================================================
// These define what happens when someone makes requests to different URLs

// Health check endpoint - useful for AWS health checks
app.get('/api/health', async (req, res) => {
  try {
    // Try to query the database to make sure it's connected
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

// Mount route handlers
// Auth routes are NOT protected (need to login first!)
app.use('/api/auth', authRoutes);

// All other routes require authentication
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

// =============================================================================
// SERVE FRONTEND (Production)
// =============================================================================
// In production, the Node.js server also serves the React frontend files

if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React build folder
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  
  // For any route that isn't an API route, serve the React app
  // This allows React Router to handle client-side routing
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
    }
  });
}

// =============================================================================
// ERROR HANDLING
// =============================================================================
// This catches any errors that weren't handled by route handlers

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Handle 404s
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// =============================================================================
// START SERVER
// =============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🟣 PurpleKit Server Running                             ║
║                                                           ║
║   Local:    http://localhost:${PORT}                        ║
║   API:      http://localhost:${PORT}/api                    ║
║   Health:   http://localhost:${PORT}/api/health             ║
║                                                           ║
║   Environment: ${process.env.NODE_ENV || 'development'}                            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});
