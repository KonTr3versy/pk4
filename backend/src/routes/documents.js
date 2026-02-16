/**
 * Document Routes
 *
 * Handles document generation and downloads with security measures:
 * - Secure file storage outside web root
 * - Randomized filenames to prevent enumeration
 * - Rate limiting for expensive operations
 * - Proper authorization checks
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const db = require('../db/connection');
const { requireFeature } = require('../middleware/features');
const {
  generatePlanDocument,
  generateExecutiveReport,
  generateTechnicalReport,
  gatherPlanData,
  gatherExecutiveReportData,
  gatherTechnicalReportData
} = require('../services/documentGenerator');
const { buildReportBundle } = require('../services/reportBundle');

// =============================================================================
// CONFIGURATION
// =============================================================================

// Document storage directory (outside web root)
const DOCS_DIR = process.env.DOCS_DIR || path.join(__dirname, '../../documents');

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Rate limiting: track generation requests per engagement
const generationRateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // Max 5 generations per hour per engagement

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

function isValidUUID(str) {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

const VALID_DOC_TYPES = ['plan', 'executive_report', 'technical_report'];

// Ensure storage directory exists
async function ensureDocsDir() {
  try {
    await fs.access(DOCS_DIR);
  } catch {
    await fs.mkdir(DOCS_DIR, { recursive: true });
  }
}

// Check rate limit
function checkRateLimit(engagementId) {
  const now = Date.now();
  const key = engagementId;

  if (!generationRateLimit.has(key)) {
    generationRateLimit.set(key, []);
  }

  const timestamps = generationRateLimit.get(key);

  // Remove expired entries
  const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  generationRateLimit.set(key, validTimestamps);

  if (validTimestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }

  validTimestamps.push(now);
  return true;
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

async function verifyEngagementAccess(req, res, next) {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid engagement ID format' });
  }

  try {
    const result = await db.query(
      'SELECT id, status, name FROM engagements WHERE id = $1 AND org_id = $2',
      [id, req.user.org_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    req.engagement = result.rows[0];
    next();
  } catch (error) {
    console.error('Error verifying engagement access:', error);
    res.status(500).json({ error: 'Failed to verify engagement access' });
  }
}

// =============================================================================
// ROUTES
// =============================================================================

// GET /api/documents/:id
// List all documents for an engagement
router.get('/:id', verifyEngagementAccess, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ed.*, u.display_name as generated_by_name
       FROM engagement_documents ed
       LEFT JOIN users u ON ed.generated_by = u.id
       WHERE ed.engagement_id = $1 AND ed.org_id = $2
       ORDER BY ed.document_type, ed.version DESC`,
      [req.params.id, req.user.org_id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});


// GET /api/documents/:engagementId/bundle
router.get('/:engagementId/bundle', requireFeature('report_bundle'), async (req, res) => {
  try {
    const { engagementId } = req.params;
    const engagementResult = await db.query(
      'SELECT id, name, org_id FROM engagements WHERE id = $1 AND org_id = $2',
      [engagementId, req.user.org_id]
    );

    if (!engagementResult.rows.length) {
      return res.status(404).json({ error: 'Engagement not found' });
    }

    const engagement = engagementResult.rows[0];
    const { files, filename } = await buildReportBundle({
      engagement,
      includeEngagementJson: req.query.include_engagement_json === 'true',
    });

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'purplekit-bundle-'));
    for (const file of files) {
      await fs.writeFile(path.join(tempDir, file.name), file.data, file.encoding ? { encoding: file.encoding } : undefined);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const zip = spawn('zip', ['-q', '-r', '-', '.'], { cwd: tempDir });

    zip.stdout.pipe(res);
    zip.stderr.on('data', (chunk) => {
      console.error('zip stderr:', chunk.toString());
    });

    zip.on('close', async (code) => {
      await fs.rm(tempDir, { recursive: true, force: true });
      if (code !== 0 && !res.headersSent) {
        res.status(500).json({ error: 'Failed to build report bundle zip' });
      }
    });
  } catch (error) {
    console.error('Error exporting report bundle:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to export report bundle' });
    }
  }
});

// POST /api/documents/:id/plan/generate
// Generate plan document
router.post('/:id/plan/generate', verifyEngagementAccess, async (req, res) => {
  try {
    const engagementId = req.params.id;
    const userId = req.user?.id;

    // Check rate limit
    if (!checkRateLimit(engagementId)) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Maximum 5 document generations per hour.'
      });
    }

    // Ensure storage directory exists
    await ensureDocsDir();

    // Get next version number
    const versionResult = await db.query(
      `SELECT COALESCE(MAX(version), 0) + 1 as next_version
       FROM engagement_documents
       WHERE engagement_id = $1 AND document_type = 'plan'`,
      [engagementId]
    );
    const version = versionResult.rows[0].next_version;

    // Generate document
    console.log(`[DOCUMENT] Generating plan document for engagement ${engagementId}`);
    const data = await gatherPlanData(engagementId);
    const buffer = await generatePlanDocument(data);

    // Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(500).json({ error: 'Generated document exceeds maximum file size' });
    }

    // Generate secure filename (UUID to prevent enumeration)
    const fileId = uuidv4();
    const fileName = `plan_${data.engagement.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${version}.docx`;
    const filePath = path.join(DOCS_DIR, `${fileId}.docx`);

    // Write file
    await fs.writeFile(filePath, buffer);

    // Record in database
    const result = await db.query(
      `INSERT INTO engagement_documents
       (engagement_id, org_id, document_type, version, file_path, file_name, file_size, generated_by)
       VALUES ($1, $2, 'plan', $3, $4, $5, $6, $7)
       RETURNING *`,
      [engagementId, req.user.org_id, version, filePath, fileName, buffer.length, userId]
    );

    // Update engagement status if first plan generation
    if (data.engagement.status === 'draft') {
      await db.query(
        `UPDATE engagements SET status = 'planning', plan_generated_at = NOW() WHERE id = $1`,
        [engagementId]
      );
    }

    // Audit log
    console.log(`[AUDIT] Plan document generated: engagement=${engagementId}, version=${version}, user=${userId}`);

    res.status(201).json({
      message: 'Plan document generated successfully',
      document: result.rows[0]
    });
  } catch (error) {
    console.error('Error generating plan document:', error);
    res.status(500).json({ error: 'Failed to generate plan document' });
  }
});

// POST /api/documents/:id/executive-report/generate
// Generate executive report
router.post('/:id/executive-report/generate', verifyEngagementAccess, async (req, res) => {
  try {
    const engagementId = req.params.id;
    const userId = req.user?.id;

    // Check engagement is in reporting or completed status
    if (!['reporting', 'completed'].includes(req.engagement.status)) {
      return res.status(400).json({
        error: 'Executive report can only be generated for engagements in reporting or completed status'
      });
    }

    // Check rate limit
    if (!checkRateLimit(engagementId)) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Maximum 5 document generations per hour.'
      });
    }

    await ensureDocsDir();

    const versionResult = await db.query(
      `SELECT COALESCE(MAX(version), 0) + 1 as next_version
       FROM engagement_documents
       WHERE engagement_id = $1 AND document_type = 'executive_report'`,
      [engagementId]
    );
    const version = versionResult.rows[0].next_version;

    // Gather data and generate executive report
    console.log(`[DOCUMENT] Generating executive report for engagement ${engagementId}`);
    const data = await gatherExecutiveReportData(engagementId);
    const buffer = await generateExecutiveReport(data);

    const fileId = uuidv4();
    const fileName = `executive_report_${data.engagement.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${version}.docx`;
    const filePath = path.join(DOCS_DIR, `${fileId}.docx`);

    await fs.writeFile(filePath, buffer);

    const result = await db.query(
      `INSERT INTO engagement_documents
       (engagement_id, org_id, document_type, version, file_path, file_name, file_size, generated_by)
       VALUES ($1, $2, 'executive_report', $3, $4, $5, $6, $7)
       RETURNING *`,
      [engagementId, req.user.org_id, version, filePath, fileName, buffer.length, userId]
    );

    console.log(`[AUDIT] Executive report generated: engagement=${engagementId}, version=${version}, user=${userId}`);

    res.status(201).json({
      message: 'Executive report generated successfully',
      document: result.rows[0]
    });
  } catch (error) {
    console.error('Error generating executive report:', error);
    res.status(500).json({ error: 'Failed to generate executive report' });
  }
});

// POST /api/documents/:id/technical-report/generate
// Generate technical report
router.post('/:id/technical-report/generate', verifyEngagementAccess, async (req, res) => {
  try {
    const engagementId = req.params.id;
    const userId = req.user?.id;

    if (!['reporting', 'completed'].includes(req.engagement.status)) {
      return res.status(400).json({
        error: 'Technical report can only be generated for engagements in reporting or completed status'
      });
    }

    if (!checkRateLimit(engagementId)) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Maximum 5 document generations per hour.'
      });
    }

    await ensureDocsDir();

    const versionResult = await db.query(
      `SELECT COALESCE(MAX(version), 0) + 1 as next_version
       FROM engagement_documents
       WHERE engagement_id = $1 AND document_type = 'technical_report'`,
      [engagementId]
    );
    const version = versionResult.rows[0].next_version;

    console.log(`[DOCUMENT] Generating technical report for engagement ${engagementId}`);
    const data = await gatherTechnicalReportData(engagementId);
    const buffer = await generateTechnicalReport(data);

    const fileId = uuidv4();
    const fileName = `technical_report_${data.engagement.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${version}.docx`;
    const filePath = path.join(DOCS_DIR, `${fileId}.docx`);

    await fs.writeFile(filePath, buffer);

    const result = await db.query(
      `INSERT INTO engagement_documents
       (engagement_id, org_id, document_type, version, file_path, file_name, file_size, generated_by)
       VALUES ($1, $2, 'technical_report', $3, $4, $5, $6, $7)
       RETURNING *`,
      [engagementId, req.user.org_id, version, filePath, fileName, buffer.length, userId]
    );

    console.log(`[AUDIT] Technical report generated: engagement=${engagementId}, version=${version}, user=${userId}`);

    res.status(201).json({
      message: 'Technical report generated successfully',
      document: result.rows[0]
    });
  } catch (error) {
    console.error('Error generating technical report:', error);
    res.status(500).json({ error: 'Failed to generate technical report' });
  }
});

// GET /api/documents/:id/:documentId/download
// Download a document
router.get('/:id/:documentId/download', verifyEngagementAccess, async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!isValidUUID(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID format' });
    }

    // Fetch document record
    const result = await db.query(
      `SELECT * FROM engagement_documents
       WHERE id = $1 AND engagement_id = $2 AND org_id = $3`,
      [documentId, req.params.id, req.user.org_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = result.rows[0];

    // Validate file path to prevent directory traversal
    const normalizedPath = path.normalize(doc.file_path);
    const normalizedDocsDir = path.normalize(DOCS_DIR);

    if (!normalizedPath.startsWith(normalizedDocsDir)) {
      console.error(`[SECURITY] Directory traversal attempt: ${doc.file_path}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check file exists
    try {
      await fs.access(doc.file_path);
    } catch {
      return res.status(404).json({ error: 'Document file not found on server' });
    }

    // Audit log
    console.log(`[AUDIT] Document downloaded: document=${documentId}, engagement=${req.params.id}, user=${req.user?.id}`);

    // Set headers for download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.file_name}"`);
    res.setHeader('Content-Length', doc.file_size);

    // Stream file to response
    const fileStream = require('fs').createReadStream(doc.file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// DELETE /api/documents/:id/:documentId
// Delete a document (admin/coordinator only)
router.delete('/:id/:documentId', verifyEngagementAccess, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user?.id;

    if (!isValidUUID(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID format' });
    }

    // Check user is admin or coordinator
    if (req.user?.role !== 'admin') {
      const roleCheck = await db.query(
        `SELECT id FROM engagement_roles
         WHERE engagement_id = $1 AND user_id = $2 AND role = 'coordinator'`,
        [req.params.id, userId]
      );

      if (roleCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Only coordinators can delete documents' });
      }
    }

    // Fetch document
    const result = await db.query(
      `SELECT * FROM engagement_documents WHERE id = $1 AND engagement_id = $2 AND org_id = $3`,
      [documentId, req.params.id, req.user.org_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = result.rows[0];

    // Delete file
    try {
      await fs.unlink(doc.file_path);
    } catch (err) {
      console.warn(`Failed to delete file: ${doc.file_path}`, err);
    }

    // Delete database record
    await db.query('DELETE FROM engagement_documents WHERE id = $1', [documentId]);

    console.log(`[AUDIT] Document deleted: document=${documentId}, engagement=${req.params.id}, user=${userId}`);

    res.json({ message: 'Document deleted', id: documentId });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;
