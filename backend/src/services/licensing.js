const crypto = require('crypto');
const db = require('../db/connection');

const LICENSE_SECRET = process.env.LICENSE_SECRET || 'purplekit-license-secret-change-me';

function b64urlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function safeCompare(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function validateLicense(licenseKey) {
  if (!licenseKey || typeof licenseKey !== 'string') {
    return { valid: false, error: 'License key is required' };
  }

  const [payloadB64, signature] = licenseKey.split('.');
  if (!payloadB64 || !signature) {
    return { valid: false, error: 'Invalid license format' };
  }

  const expectedSignature = crypto.createHmac('sha256', LICENSE_SECRET).update(payloadB64).digest('hex');
  if (!safeCompare(expectedSignature, signature)) {
    return { valid: false, error: 'Invalid license signature' };
  }

  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64));
  } catch {
    return { valid: false, error: 'Invalid license payload' };
  }

  const validUntil = payload.validUntil ? new Date(payload.validUntil) : null;
  if (validUntil && Number.isNaN(validUntil.getTime())) {
    return { valid: false, error: 'Invalid validUntil in license payload' };
  }

  if (validUntil && validUntil < new Date()) {
    return { valid: false, error: 'License expired' };
  }

  return {
    valid: true,
    plan: payload.plan || 'pro',
    features: payload.features || {},
    validUntil,
    seats: payload.seats || null,
  };
}

async function upsertOrgLicense(orgId, licenseKey) {
  const checked = validateLicense(licenseKey);
  if (!checked.valid) {
    return checked;
  }

  await db.query(
    `INSERT INTO licenses (org_id, license_key, plan, features, seats, valid_until, last_validated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, NOW())
     ON CONFLICT (org_id) DO UPDATE SET
      license_key = EXCLUDED.license_key,
      plan = EXCLUDED.plan,
      features = EXCLUDED.features,
      seats = EXCLUDED.seats,
      valid_until = EXCLUDED.valid_until,
      last_validated_at = NOW()`,
    [orgId, licenseKey, checked.plan, JSON.stringify(checked.features), checked.seats, checked.validUntil]
  );

  return checked;
}

async function getOrgFeatures(orgId) {
  const result = await db.query(
    `SELECT features, valid_until, license_key
     FROM licenses
     WHERE org_id = $1`,
    [orgId]
  );

  if (!result.rows.length) {
    return { valid: false, features: {} };
  }

  const row = result.rows[0];
  const validation = validateLicense(row.license_key);
  if (!validation.valid) {
    return { valid: false, features: row.features || {} };
  }

  if (row.valid_until && new Date(row.valid_until) < new Date()) {
    return { valid: false, features: row.features || {} };
  }

  return { valid: true, features: row.features || {} };
}

module.exports = {
  validateLicense,
  upsertOrgLicense,
  getOrgFeatures,
};
