/**
 * Authentication Routes
 * 
 * Handles user authentication:
 * - POST /api/auth/login - Login with username/password
 * - POST /api/auth/logout - Logout (client-side token removal)
 * - GET /api/auth/me - Get current user info
 * - POST /api/auth/users - Create new user (admin only)
 * - GET /api/auth/users - List all users (admin only)
 * - POST /api/auth/setup - Initial setup (create first admin user)
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../db/connection');
const {
  requireAuth,
  requireAdmin,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  JWT_SECRET,
} = require('../middleware/auth');

function sanitizeInput(value) {
  if (typeof value !== 'string') {
    return value;
  }

  return value
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}

// =============================================================================
// POST /api/auth/setup
// =============================================================================
// Creates the initial admin user. Only works if no users exist.
router.post('/setup', async (req, res) => {
  try {
    const username = sanitizeInput(req.body.username || req.body.email);
    const password = req.body.password;
    const displayName = sanitizeInput(req.body.displayName || req.body.name);
    const orgName = sanitizeInput(req.body.orgName);
    
    // Check if any users exist
    const existingUsers = await db.query('SELECT COUNT(*) FROM users');
    if (parseInt(existingUsers.rows[0].count) > 0) {
      return res.status(409).json({ error: 'Setup already completed. Admin user already exists.' });
    }
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    const orgResult = await db.query(
      `INSERT INTO orgs (name) VALUES ($1)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [orgName || 'Default Org']
    );
    const fallbackOrg = await db.query('SELECT id FROM orgs ORDER BY created_at ASC LIMIT 1');
    const defaultOrgId = orgResult.rows[0]?.id || fallbackOrg.rows[0]?.id;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create admin user
    const result = await db.query(
      `INSERT INTO users (username, password_hash, display_name, role, org_id)
       VALUES ($1, $2, $3, 'admin', $4)
       RETURNING id, username, display_name, role, org_id, created_at`,
      [username.toLowerCase(), passwordHash, displayName || username, defaultOrgId]
    );
    
    const user = result.rows[0];
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    
    res.status(201).json({
      message: 'Admin user created successfully',
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        orgId: user.org_id,
      },
      token,
      refreshToken,
      org: {
        id: defaultOrgId,
        name: orgName || 'Default Org',
      },
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// =============================================================================
// GET /api/auth/status
// =============================================================================
// Check if setup is needed (no users exist)
router.get('/status', async (req, res) => {
  try {
    const result = await db.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(result.rows[0].count);
    const setupRequired = userCount === 0;
    const authHeader = req.headers.authorization;
    let authenticated = false;
    let user = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        authenticated = true;
      } catch {
        authenticated = false;
        user = null;
      }
    }

    let org = null;
    if (user?.org_id) {
      const orgResult = await db.query('SELECT id, name FROM orgs WHERE id = $1', [user.org_id]);
      org = orgResult.rows[0] || null;
    }
    
    res.json({
      setupRequired,
      authenticated,
      user: authenticated
        ? {
            id: user.id,
            role: user.role,
            org_id: user.org_id,
          }
        : null,
      org,
      userCount,
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// =============================================================================
// POST /api/auth/login
// =============================================================================
// Authenticate user and return JWT token
router.post('/login', async (req, res) => {
  try {
    const username = sanitizeInput(req.body.username);
    const password = req.body.password;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user
    const result = await db.query(
      'SELECT * FROM users WHERE username = $1',
      [username.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Generate token
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        orgId: user.org_id,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// =============================================================================
// GET /api/auth/me
// =============================================================================
// Get current authenticated user's info
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, display_name, role, org_id, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      orgId: user.org_id,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// =============================================================================
// POST /api/auth/refresh
// =============================================================================
// Refresh access token using refresh token
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const result = await db.query(
      'SELECT id, username, display_name, role, org_id FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const token = generateToken(user);
    const nextRefreshToken = generateRefreshToken(user);

    res.json({
      token,
      refreshToken: nextRefreshToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// =============================================================================
// POST /api/auth/users
// =============================================================================
// Create a new user (admin only)
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const username = sanitizeInput(req.body.username);
    const password = req.body.password;
    const displayName = sanitizeInput(req.body.displayName);
    const role = sanitizeInput(req.body.role);
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    const orgResult = await db.query(
      `INSERT INTO orgs (name) VALUES ('Default Org')
       ON CONFLICT DO NOTHING
       RETURNING id`
    );
    const fallbackOrg = await db.query('SELECT id FROM orgs ORDER BY created_at ASC LIMIT 1');
    const defaultOrgId = orgResult.rows[0]?.id || fallbackOrg.rows[0]?.id;

    // Check if username exists
    const existing = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username.toLowerCase()]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const result = await db.query(
      `INSERT INTO users (username, password_hash, display_name, role, org_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, display_name, role, org_id, created_at`,
      [username.toLowerCase(), passwordHash, displayName || username, role || 'user', req.user.org_id]
    );
    
    const user = result.rows[0];
    res.status(201).json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      orgId: user.org_id,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// =============================================================================
// GET /api/auth/users
// =============================================================================
// List all users (admin only)
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, display_name, role, org_id, created_at FROM users WHERE org_id = $1 ORDER BY created_at DESC',
      [req.user.org_id]
    );
    
    res.json(result.rows.map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
      orgId: user.org_id,
      createdAt: user.created_at,
    })));
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// =============================================================================
// DELETE /api/auth/users/:id
// =============================================================================
// Delete a user (admin only)
router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting yourself
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted', id });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
    const orgResult = await db.query(
      `INSERT INTO orgs (name) VALUES ('Default Org')
       ON CONFLICT DO NOTHING
       RETURNING id`
    );
    const fallbackOrg = await db.query('SELECT id FROM orgs ORDER BY created_at ASC LIMIT 1');
    const defaultOrgId = orgResult.rows[0]?.id || fallbackOrg.rows[0]?.id;
