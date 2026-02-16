const request = require('supertest');
const { randomUUID } = require('crypto');
const { createMockDb } = require('./mockDb');
const { generateToken } = require('../src/middleware/auth');

const mockDb = createMockDb();

jest.mock('../src/db/connection', () => mockDb);

const app = require('../src/app');

describe('Analytics / Threat Pipeline / Planning route validation', () => {
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    token = generateToken({
      id: randomUUID(),
      username: 'tester',
      role: 'admin',
      org_id: randomUUID(),
    });
  });

  test('analytics engagement endpoints reject invalid engagement UUIDs', async () => {
    const metrics = await request(app)
      .get('/api/analytics/not-a-uuid/metrics')
      .set('Authorization', `Bearer ${token}`);

    const calculate = await request(app)
      .post('/api/analytics/not-a-uuid/metrics/calculate')
      .set('Authorization', `Bearer ${token}`);

    expect(metrics.status).toBe(400);
    expect(metrics.body).toEqual({ error: 'Invalid engagement ID format' });
    expect(calculate.status).toBe(400);
    expect(calculate.body).toEqual({ error: 'Invalid engagement ID format' });
  });

  test('risk quantification endpoints reject invalid action-item UUIDs', async () => {
    const riskRead = await request(app)
      .get('/api/analytics/action-items/not-a-uuid/risk-quantification')
      .set('Authorization', `Bearer ${token}`);

    const riskWrite = await request(app)
      .post('/api/analytics/action-items/not-a-uuid/risk-quantification')
      .set('Authorization', `Bearer ${token}`)
      .send({ tef_min: 1, tef_max: 2 });

    expect(riskRead.status).toBe(400);
    expect(riskRead.body).toEqual({ error: 'Invalid action item ID format' });
    expect(riskWrite.status).toBe(400);
    expect(riskWrite.body).toEqual({ error: 'Invalid action item ID format' });
  });

  test('threat pipeline endpoints validate source and resource IDs', async () => {
    const invalidSource = await request(app)
      .post('/api/threat-pipeline')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: 'bad-source', title: 'New thing' });

    const badId = await request(app)
      .put('/api/threat-pipeline/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'triaging' });

    expect(invalidSource.status).toBe(400);
    expect(invalidSource.body.error).toMatch('Invalid source');
    expect(badId.status).toBe(400);
    expect(badId.body).toEqual({ error: 'Invalid threat item ID format' });
  });

  test('workflow planning phase endpoints reject invalid engagement UUIDs', async () => {
    const getPhases = await request(app)
      .get('/api/workflow/not-a-uuid/planning-phases')
      .set('Authorization', `Bearer ${token}`);

    const createPhase = await request(app)
      .post('/api/workflow/not-a-uuid/planning-phases')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase_name: 'objective_setting', phase_order: 1 });

    expect(getPhases.status).toBe(400);
    expect(getPhases.body).toEqual({ error: 'Invalid engagement ID format' });
    expect(createPhase.status).toBe(400);
    expect(createPhase.body).toEqual({ error: 'Invalid engagement ID format' });
  });
});
