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
const router = express.Router();
const db = require('../db/connection');
const { requireAuth, requireAdmin, generateToken } = require('../middleware/auth');

// =============================================================================
// POST /api/auth/setup
// =============================================================================
// Creates the initial admin user. Only works if no users exist.
router.post('/setup', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;
    
    // Check if any users exist
    const existingUsers = await db.query('SELECT COUNT(*) FROM users');
    if (parseInt(existingUsers.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Setup already completed. Users exist.' });
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
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create admin user
    const result = await db.query(
      `INSERT INTO users (username, password_hash, display_name, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, username, display_name, role, created_at`,
      [username.toLowerCase(), passwordHash, displayName || username]
    );
    
    const user = result.rows[0];
    const token = generateToken(user);
    
    res.status(201).json({
      message: 'Admin user created successfully',
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
      token,
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
    
    res.json({
      setupRequired: userCount === 0,
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
    const { username, password } = req.body;
    
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
    
    res.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
      token,
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
      'SELECT id, username, display_name, role, created_at FROM users WHERE id = $1',
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
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// =============================================================================
// POST /api/auth/users
// =============================================================================
// Create a new user (admin only)
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, password, displayName, role } = req.body;
    
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
      `INSERT INTO users (username, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, display_name, role, created_at`,
      [username.toLowerCase(), passwordHash, displayName || username, role || 'user']
    );
    
    const user = result.rows[0];
    res.status(201).json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
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
      'SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at DESC'
    );
    
    res.json(result.rows.map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
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
