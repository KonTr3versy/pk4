const express = require('express');

jest.mock('../../db/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

const db = require('../../db/connection');
const engagementsRouter = require('../engagements');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: 'user-1', role: 'user' };
    next();
  });
  app.use('/api/engagements', engagementsRouter);
  return app;
}

async function makeRequest(app, method, path, body) {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return {
      status: response.status,
      body: await response.json()
    };
  } finally {
    server.close();
  }
}

describe('engagements router regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /:id/techniques returns 404 when engagement does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const response = await makeRequest(createApp(), 'GET', '/api/engagements/eng-1/techniques');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Engagement not found' });
  });

  test('PATCH /:id/techniques/:techniqueId/status keeps status validation behavior', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'tech-1', status: 'ready' }] });

    const response = await makeRequest(
      createApp(),
      'PATCH',
      '/api/engagements/eng-1/techniques/tech-1/status',
      { status: 'invalid-status' }
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Status must be one of');
  });

  test('POST /:id/checklist requires item_key and item_label', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'eng-1' }] });

    const response = await makeRequest(
      createApp(),
      'POST',
      '/api/engagements/eng-1/checklist',
      { item_key: 'key-only' }
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'item_key and item_label are required' });
  });

  test('POST /:id/dependencies still blocks self-dependencies', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'eng-1' }] });

    const response = await makeRequest(
      createApp(),
      'POST',
      '/api/engagements/eng-1/dependencies',
      { technique_id: 'T1001', prerequisite_id: 'T1001' }
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'A technique cannot depend on itself' });
  });
});
