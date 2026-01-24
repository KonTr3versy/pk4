/**
 * Database Connection Module
 * 
 * This sets up the connection to PostgreSQL.
 * It uses a "connection pool" which means it keeps several connections
 * open and reuses them, rather than opening a new one for every query.
 */

const { Pool } = require('pg');

// Create a connection pool
// The Pool automatically manages connections for us
const pool = new Pool({
  // If DATABASE_URL is set, use it (production)
  // Otherwise, use individual environment variables (development)
  connectionString: process.env.DATABASE_URL,
  
  // SSL is required for AWS RDS
  // In development with local Docker, we disable it
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
    
  // Pool configuration
  max: 10,              // Maximum 10 connections in the pool
  idleTimeoutMillis: 30000,  // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000,  // Return an error if can't connect in 2 seconds
});

// Test the connection when the module loads
pool.on('connect', () => {
  console.log('📦 Database: Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('📦 Database: Unexpected error', err);
});

// Export a query function that uses the pool
module.exports = {
  /**
   * Execute a SQL query
   * 
   * @param {string} text - The SQL query
   * @param {Array} params - Query parameters (prevents SQL injection)
   * @returns {Promise} Query result
   * 
   * @example
   * // Simple query
   * const result = await db.query('SELECT * FROM engagements');
   * 
   * // Parameterized query (ALWAYS use this with user input!)
   * const result = await db.query(
   *   'SELECT * FROM engagements WHERE id = $1',
   *   [engagementId]
   * );
   */
  query: (text, params) => pool.query(text, params),
  
  /**
   * Get a client from the pool for transactions
   * Remember to release it when done!
   * 
   * @example
   * const client = await db.getClient();
   * try {
   *   await client.query('BEGIN');
   *   // ... do stuff
   *   await client.query('COMMIT');
   * } catch (e) {
   *   await client.query('ROLLBACK');
   *   throw e;
   * } finally {
   *   client.release();
   * }
   */
  getClient: () => pool.connect(),
  
  // Export the pool itself if needed
  pool,
};
