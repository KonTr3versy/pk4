/**
 * Authentication Middleware
 * 
 * Verifies JWT tokens and protects routes that require authentication.
 */

const jwt = require('jsonwebtoken');

// Secret key for JWT signing - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'purplekit-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
const JWT_ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL || '15m';
const JWT_REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL || '7d';

/**
 * Middleware that requires authentication
 * Checks for valid JWT token in Authorization header
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid token format' });
  }
  
  const token = parts[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Attach user info to request for use in route handlers
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware that requires admin role
 * Must be used after requireAuth
 */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Generate a JWT token for a user
 */
function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username,
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_TOKEN_TTL }
  );
}

/**
 * Generate a refresh token for a user
 */
function generateRefreshToken(user) {
  return jwt.sign(
    {
      id: user.id,
      tokenType: 'refresh',
    },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_TOKEN_TTL }
  );
}

/**
 * Verify a refresh token
 */
function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  if (decoded.tokenType !== 'refresh') {
    throw new Error('Invalid refresh token');
  }
  return decoded;
}

module.exports = {
  requireAuth,
  requireAdmin,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  JWT_ACCESS_TOKEN_TTL,
  JWT_REFRESH_TOKEN_TTL,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
};
