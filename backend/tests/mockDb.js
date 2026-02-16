const { randomUUID } = require('crypto');

function createMockDb() {
  const state = {
    users: [],
    engagements: [],
    techniques: [],
    approvals: [],
    engagementRoles: [],
    actionItems: []
  };

  const normalize = (text) => text.replace(/\s+/g, ' ').trim().toLowerCase();

  const queryImpl = async (text, params = []) => {
    const sql = normalize(text);

    if (sql.includes('from information_schema.columns') && sql.includes("column_name = 'position'")) {
      return { rows: [{ '?column?': 1 }] };
    }

    if (sql === 'select count(*) from users') {
      return { rows: [{ count: String(state.users.length) }] };
    }

    if (sql.includes('insert into users')) {
      const user = {
        id: randomUUID(),
        username: params[0],
        password_hash: params[1],
        display_name: params[2],
        role: sql.includes("'admin'") ? 'admin' : (params[3] || 'user'),
        created_at: new Date().toISOString()
      };
      state.users.push(user);
      return { rows: [user] };
    }

    if (sql.includes('select * from users where username = $1')) {
      return { rows: state.users.filter((u) => u.username === params[0]) };
    }

    if (sql.includes('from users where id = $1')) {
      return { rows: state.users.filter((u) => u.id === params[0]) };
    }

    if (sql.includes('insert into engagements')) {
      const engagement = {
        id: randomUUID(),
        name: params[0],
        description: params[1],
        methodology: params[2],
        status: 'draft',
        created_at: new Date().toISOString()
      };
      state.engagements.push(engagement);
      return { rows: [engagement] };
    }

    if (sql.includes('update engagements set') && sql.includes('where id =')) {
      const id = sql.includes('where id = $1') ? params[0] : params[params.length - 1];
      const engagement = state.engagements.find((e) => e.id === id);
      if (!engagement) return { rows: [] };

      if (sql.includes('status = $2')) {
        engagement.status = params[1];
      }
      if (sql.includes('name = $1')) {
        engagement.name = params[0];
      }

      return { rows: [engagement] };
    }

    if (sql.includes('delete from engagements where id = $1 returning id')) {
      const idx = state.engagements.findIndex((e) => e.id === params[0]);
      if (idx === -1) return { rows: [] };
      const [deleted] = state.engagements.splice(idx, 1);
      return { rows: [{ id: deleted.id }] };
    }

    if (sql.includes('select id, status, name from engagements where id = $1') || sql.includes('select id, status from engagements where id = $1') || sql.includes('select * from engagements where id = $1')) {
      return { rows: state.engagements.filter((e) => e.id === params[0]) };
    }

    if (sql.includes('select id from engagement_roles') && sql.includes('limit 1')) {
      const rows = state.engagementRoles.filter((r) => r.engagement_id === params[0] && r.user_id === params[1]).slice(0, 1).map((r) => ({ id: r.id || randomUUID() }));
      return { rows };
    }

    if (sql.includes('select role from engagement_roles')) {
      const rows = state.engagementRoles.filter((r) => r.engagement_id === params[0] && r.user_id === params[1] && ['coordinator', 'stakeholder', 'sponsor'].includes(r.role));
      return { rows };
    }

    if (sql.includes('select distinct role from engagement_roles')) {
      const roles = state.engagementRoles
        .filter((r) => r.engagement_id === params[0] && ['coordinator', 'stakeholder', 'sponsor', 'red_team_lead', 'blue_team_lead', 'red_lead', 'blue_lead'].includes(r.role))
        .map((r) => r.role);
      return { rows: [...new Set(roles)].map((role) => ({ role })) };
    }

    if (sql.includes('select pa.role from plan_approvals')) {
      return { rows: state.approvals.filter((a) => a.engagement_id === params[0] && a.approved_at).map((a) => ({ role: a.role })) };
    }

    if (sql.includes('select count(*) as count from techniques where engagement_id = $1 and status in')) {
      const count = state.techniques.filter((t) => t.engagement_id === params[0] && ['complete', 'done'].includes(t.status)).length;
      return { rows: [{ count: String(count) }] };
    }

    if (sql.includes('select count(*) as count from techniques where engagement_id = $1')) {
      const count = state.techniques.filter((t) => t.engagement_id === params[0]).length;
      return { rows: [{ count: String(count) }] };
    }

    if (sql.includes('select id, status, position from techniques where id = $1 and engagement_id = $2')) {
      const technique = state.techniques.find((t) => t.id === params[0] && t.engagement_id === params[1]);
      return { rows: technique ? [technique] : [] };
    }

    if (sql.includes('update techniques set position = position + 1')) {
      return { rows: [] };
    }

    if (sql.includes('update techniques set status = $1, position = $2')) {
      const technique = state.techniques.find((t) => t.id === params[2]);
      if (technique) {
        technique.status = params[0];
        technique.position = params[1];
      }
      return { rows: [] };
    }

    if (sql.includes('update techniques') && sql.includes('returning *')) {
      const id = params[params.length - 1];
      const technique = state.techniques.find((t) => t.id === id);
      if (!technique) return { rows: [] };
      if (sql.includes('status = $1')) technique.status = params[0];
      return { rows: [technique] };
    }

    if (sql.includes('select ai.id, ai.engagement_id') && sql.includes('from action_items ai') && sql.includes('where ai.id = $1')) {
      const actionItem = state.actionItems.find((ai) => ai.id === params[0]);
      return { rows: actionItem ? [{ id: actionItem.id, engagement_id: actionItem.engagement_id }] : [] };
    }

    if (sql.includes('update action_items') && sql.includes('returning *')) {
      const id = params[params.length - 1];
      const actionItem = state.actionItems.find((ai) => ai.id === id);
      if (!actionItem) return { rows: [] };
      if (sql.includes('title = $1')) actionItem.title = params[0];
      if (sql.includes('status = $1')) actionItem.status = params[0];
      return { rows: [actionItem] };
    }

    if (sql.includes('delete from action_items where id = $1 returning id')) {
      const idx = state.actionItems.findIndex((ai) => ai.id === params[0]);
      if (idx === -1) return { rows: [] };
      const [deleted] = state.actionItems.splice(idx, 1);
      return { rows: [{ id: deleted.id }] };
    }

    if (sql.includes('from techniques t left join detection_outcomes') && sql.includes('where t.id = $1')) {
      const technique = state.techniques.find((t) => t.id === params[0]);
      return { rows: technique ? [{ ...technique, outcomes: [] }] : [] };
    }

    if (sql.includes('from techniques t left join detection_outcomes') && sql.includes('where t.engagement_id = $1')) {
      return { rows: state.techniques.filter((t) => t.engagement_id === params[0]).map((t) => ({ ...t, outcomes: [] })) };
    }

    if (sql.includes('select e.*, count(t.id) as technique_count')) {
      return { rows: state.engagements.map((e) => ({ ...e, technique_count: '0', completed_count: '0' })) };
    }

    if (sql.includes('begin') || sql.includes('commit') || sql.includes('rollback') || sql.includes('delete from detection_outcomes')) {
      return { rows: [] };
    }

    if (sql.includes('insert into technique_usage')) {
      return { rows: [] };
    }

    if (sql.includes('delete from techniques where id = $1 returning id')) {
      const idx = state.techniques.findIndex((t) => t.id === params[0]);
      if (idx === -1) return { rows: [] };
      const [deleted] = state.techniques.splice(idx, 1);
      return { rows: [{ id: deleted.id }] };
    }

    throw new Error(`Unhandled SQL in test mock: ${sql}`);
  };

  const client = {
    query: jest.fn(queryImpl),
    release: jest.fn()
  };

  return {
    state,
    query: jest.fn(queryImpl),
    getClient: jest.fn(async () => client),
    __client: client
  };
}

module.exports = { createMockDb };
