const request = require('supertest');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const { createMockDb } = require('./mockDb');
const { generateToken } = require('../src/middleware/auth');

const mockDb = createMockDb();

jest.mock('../src/db/connection', () => mockDb);

const app = require('../src/app');

describe('Critical API behavior', () => {
  let token;
  let userId;
  let engagementId;
  let techniqueId;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb.state.users = [];
    mockDb.state.engagements = [];
    mockDb.state.techniques = [];
    mockDb.state.approvals = [];
    mockDb.state.engagementRoles = [];
    mockDb.state.actionItems = [];

    const passwordHash = await bcrypt.hash('Password123!', 10);
    userId = randomUUID();

    mockDb.state.users.push({
      id: userId,
      username: 'admin',
      password_hash: passwordHash,
      display_name: 'Admin',
      role: 'admin',
      created_at: new Date().toISOString()
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Password123!' });

    token = loginRes.body.token;

    engagementId = randomUUID();
    techniqueId = randomUUID();

    mockDb.state.engagements.push({
      id: engagementId,
      name: 'Primary Engagement',
      description: 'desc',
      methodology: 'atomic',
      status: 'planning',
      created_at: new Date().toISOString()
    });

    mockDb.state.techniques.push({
      id: techniqueId,
      engagement_id: engagementId,
      technique_id: 'T1003',
      technique_name: 'Credential Dumping',
      tactic: 'credential-access',
      status: 'ready',
      position: 1
    });

    mockDb.state.engagementRoles.push(
      { engagement_id: engagementId, user_id: userId, role: 'coordinator' },
      { engagement_id: engagementId, user_id: userId, role: 'stakeholder' }
    );
  });

  test('auth setup/login and token-protected access', async () => {
    mockDb.state.users = [];

    const setup = await request(app).post('/api/auth/setup').send({
      username: 'firstadmin',
      password: 'Password123!',
      displayName: 'First Admin'
    });
    expect(setup.status).toBe(201);
    expect(setup.body.token).toBeTruthy();

    const unauthorized = await request(app).get('/api/auth/me');
    expect(unauthorized.status).toBe(401);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'firstadmin', password: 'Password123!' });
    expect(login.status).toBe(200);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(me.status).toBe(200);
    expect(me.body.username).toBe('firstadmin');
  });

  test('engagement create/update/delete and update validation failure', async () => {
    const create = await request(app)
      .post('/api/engagements')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '  New Engagement  ', methodology: 'atomic' });

    expect(create.status).toBe(201);

    const updateBadStatus = await request(app)
      .put(`/api/engagements/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'invalid-status' });

    expect(updateBadStatus.status).toBe(400);

    const update = await request(app)
      .put(`/api/engagements/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Engagement', status: 'active' });

    expect(update.status).toBe(200);
    expect(update.body.name).toBe('Updated Engagement');

    const del = await request(app)
      .delete(`/api/engagements/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(del.status).toBe(200);
    expect(del.body.message).toBe('Engagement deleted');
  });

  test('engagement update rejects invalid name payloads with deterministic 400 responses', async () => {
    const invalidNames = [
      { name: null, expectedError: 'name must be a string' },
      { name: 123, expectedError: 'name must be a string' },
      { name: '   ', expectedError: 'name cannot be empty' }
    ];

    for (const invalidName of invalidNames) {
      const response = await request(app)
        .put(`/api/engagements/${engagementId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: invalidName.name });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: invalidName.expectedError });
    }
  });

  test('technique status transition update and reorder endpoint behavior', async () => {
    const invalidTechniqueStatus = await request(app)
      .put(`/api/techniques/${techniqueId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'bad-status' });

    expect(invalidTechniqueStatus.status).toBe(400);

    const updateTechnique = await request(app)
      .put(`/api/techniques/${techniqueId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'executing' });

    expect(updateTechnique.status).toBe(200);
    expect(updateTechnique.body.status).toBe('executing');

    const reorder = await request(app)
      .patch(`/api/engagements/${engagementId}/techniques/reorder`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        techniqueId,
        newStatus: 'done',
        newPosition: 2
      });

    expect(reorder.status).toBe(200);
    expect(reorder.body).toMatchObject({
      success: true,
      techniqueId,
      newStatus: 'done',
      newPosition: 2
    });
  });

  test('approval transition constraints and bad UUID handling', async () => {
    const badUuid = await request(app)
      .post('/api/approvals/not-a-uuid/transition')
      .set('Authorization', `Bearer ${token}`)
      .send({ target_status: 'ready' });

    expect(badUuid.status).toBe(400);

    const invalidTransition = await request(app)
      .post(`/api/approvals/${engagementId}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ target_status: 'completed' });

    expect(invalidTransition.status).toBe(400);

    const missingApprovals = await request(app)
      .post(`/api/approvals/${engagementId}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ target_status: 'ready' });

    expect(missingApprovals.status).toBe(400);

    mockDb.state.approvals.push(
      { engagement_id: engagementId, role: 'coordinator', approved_at: new Date().toISOString() },
      { engagement_id: engagementId, role: 'stakeholder', approved_at: new Date().toISOString() }
    );

    const okTransition = await request(app)
      .post(`/api/approvals/${engagementId}/transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({ target_status: 'ready' });

    expect(okTransition.status).toBe(200);
    expect(okTransition.body.engagement.status).toBe('ready');
  });

  test('export json endpoint success path and unauthorized access rejection', async () => {
    const noToken = await request(app).get(`/api/export/${engagementId}/json`);
    expect(noToken.status).toBe(401);

    const exportRes = await request(app)
      .get(`/api/export/${engagementId}/json`)
      .set('Authorization', `Bearer ${token}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain('application/json');
    expect(exportRes.body.engagement.name).toBe('Primary Engagement');
    expect(Array.isArray(exportRes.body.techniques)).toBe(true);
  });

  test('action item update/delete reject cross-engagement access', async () => {
    const memberPasswordHash = await bcrypt.hash('Password123!', 10);
    const memberId = randomUUID();

    mockDb.state.users.push({
      id: memberId,
      username: 'member',
      password_hash: memberPasswordHash,
      display_name: 'Member User',
      role: 'user',
      created_at: new Date().toISOString()
    });

    const memberToken = generateToken({
      id: memberId,
      username: 'member',
      role: 'user'
    });
    const otherEngagementId = randomUUID();
    const protectedItemId = randomUUID();

    mockDb.state.engagements.push({
      id: otherEngagementId,
      name: 'Other Engagement',
      description: 'other',
      methodology: 'atomic',
      status: 'planning',
      created_at: new Date().toISOString()
    });

    mockDb.state.engagementRoles.push({
      engagement_id: engagementId,
      user_id: memberId,
      role: 'operator'
    });

    mockDb.state.actionItems.push({
      id: protectedItemId,
      engagement_id: otherEngagementId,
      title: 'Protected item',
      status: 'open'
    });

    const updateRes = await request(app)
      .put(`/api/action-items/item/${protectedItemId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Attempted edit' });

    expect(updateRes.status).toBe(403);
    expect(updateRes.body.error).toBe('Access denied');

    const deleteRes = await request(app)
      .delete(`/api/action-items/item/${protectedItemId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.error).toBe('Access denied');

    expect(mockDb.state.actionItems.some((item) => item.id === protectedItemId)).toBe(true);
  });

});
