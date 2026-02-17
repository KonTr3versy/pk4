const request = require('supertest');
const { generateToken } = require('../src/middleware/auth');

const state = {
  engagements: [{ id: 'eng-1', org_id: 'org-1' }, { id: 'eng-2', org_id: 'org-2' }],
  packs: [{ id: 'pack-1', org_id: null, name: 'Starter' }, { id: 'pack-2', org_id: 'org-2', name: 'Other' }],
  packTechniques: [{ pack_id: 'pack-1', technique_id: 'T1003.001' }, { pack_id: 'pack-1', technique_id: 'T1059.001' }],
  techniques: [{ engagement_id: 'eng-1', technique_id: 'T1003.001', position: 1 }],
  history: [],
};

const mockDb = {
  query: jest.fn(async (sql, params) => {
    if (sql.includes('SELECT id, org_id FROM engagements')) {
      return { rows: state.engagements.filter(e => e.id === params[0] && e.org_id === params[1]) };
    }
    if (sql.includes('SELECT id, org_id, name FROM packs')) {
      return { rows: state.packs.filter(p => p.id === params[0] && (p.org_id === null || p.org_id === params[1])) };
    }
    if (sql.includes('FROM pack_techniques')) {
      return { rows: state.packTechniques.filter(p => p.pack_id === params[0]).map(p => ({ ...p, technique_name: p.technique_id, tactic: 'Execution' })) };
    }
    if (sql.includes('SELECT technique_id FROM techniques')) {
      return { rows: state.techniques.filter(t => t.engagement_id === params[0] && params[1].includes(t.technique_id)) };
    }
    if (sql.includes('SELECT COALESCE(MAX(position), 0)')) {
      const rows = state.techniques.filter(t => t.engagement_id === params[0]);
      return { rows: [{ max_pos: rows.length ? Math.max(...rows.map(t => t.position || 0)) : 0 }] };
    }
    if (sql.includes('INSERT INTO techniques')) {
      state.techniques.push({ engagement_id: params[0], technique_id: params[2], position: params[6] });
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO technique_history')) {
      state.history.push({ technique_id: params[0], engagement_id: params[1] });
      return { rows: [] };
    }
    return { rows: [] };
  }),
  getClient: async () => ({ query: mockDb.query, release: () => {} }),
};

jest.mock('../src/db/connection', () => mockDb);
const app = require('../src/app');

describe('apply pack endpoint', () => {
  beforeEach(() => {
    state.techniques = [{ engagement_id: 'eng-1', technique_id: 'T1003.001', position: 1 }];
    state.history = [];
  });

  test('dedupes and adds history entries', async () => {
    const token = generateToken({ id: 'user-1', username: 'admin', role: 'admin', org_id: 'org-1' });
    const response = await request(app)
      .post('/api/engagements/eng-1/packs/pack-1/apply')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ added: 1, skipped: 1 });
    expect(state.history).toHaveLength(1);
  });

  test('enforces org scoping for pack visibility', async () => {
    const token = generateToken({ id: 'user-1', username: 'admin', role: 'admin', org_id: 'org-1' });
    const response = await request(app)
      .post('/api/engagements/eng-1/packs/pack-2/apply')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });
});
