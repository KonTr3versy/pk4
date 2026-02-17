const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('API route contract alignment', () => {
  const client = read('../frontend/src/api/client.js');
  const workflowRoutes = read('src/routes/workflow.js');
  const actionRoutes = read('src/routes/action-items.js');
  const approvalRoutes = read('src/routes/approvals.js');
  const analyticsRoutes = read('src/routes/analytics.js');
  const threatPipelineRoutes = read('src/routes/threat-pipeline.js');

  test('technique expectation routes are technique-scoped', () => {
    expect(workflowRoutes).toContain("router.get('/:id/techniques/:techId/expectations'");
    expect(client).toContain('/workflow/${engagementId}/techniques/${techId}/expectations');
    expect(client).not.toContain('/workflow/${engagementId}/expectations');
  });

  test('action item update/delete use item route', () => {
    expect(actionRoutes).toContain("router.put('/item/:itemId'");
    expect(actionRoutes).toContain("router.delete('/item/:itemId'");
    expect(client).toContain('/action-items/item/${itemId}');
  });

  test('technique results are technique-scoped', () => {
    expect(actionRoutes).toContain("router.get('/:id/techniques/:techId/results'");
    expect(actionRoutes).toContain("router.post('/:id/techniques/:techId/results'");
    expect(client).toContain('/action-items/${engagementId}/techniques/${techId}/results');
  });

  test('engagement status updates use transition endpoint', () => {
    expect(approvalRoutes).toContain("router.post('/:id/transition'");
    expect(client).toContain('/approvals/${engagementId}/transition');
    expect(client).toContain('target_status: newStatus');
  });

  test('action item owner filter key is owner_id', () => {
    expect(actionRoutes).toContain('const { status, severity, owner_id, owner } = req.query;');
    expect(client).toContain("params.append('owner_id', filters.owner_id)");
  });

  test('planning phase API client and workflow routes are aligned', () => {
    expect(workflowRoutes).toContain("router.get('/:id/planning-phases'");
    expect(workflowRoutes).toContain("router.post('/:id/planning-phases'");
    expect(workflowRoutes).toContain("router.put('/:id/planning-phases/:phaseId'");
    expect(workflowRoutes).toContain("router.get('/role-defaults'");

    expect(client).toContain('/workflow/${engagementId}/planning-phases');
    expect(client).toContain('/workflow/${engagementId}/planning-phases/${phaseId}/attendees');
    expect(client).toContain('/workflow/${engagementId}/planning-phases/${phaseId}/outputs');
    expect(client).toContain('/workflow/role-defaults');
  });

  test('analytics and threat-pipeline client bindings match route modules', () => {
    expect(analyticsRoutes).toContain("router.post('/:engagementId/metrics/calculate'");
    expect(analyticsRoutes).toContain("router.get('/:engagementId/metrics'");
    expect(analyticsRoutes).toContain("router.post('/organizations/:orgId/attack-coverage/export-navigator'");
    expect(analyticsRoutes).toContain("router.post('/:engagementId/ai/generate-summary'");

    expect(threatPipelineRoutes).toContain("router.get('/'");
    expect(threatPipelineRoutes).toContain("router.post('/'");
    expect(threatPipelineRoutes).toContain("router.put('/:id'");
    expect(threatPipelineRoutes).toContain("router.delete('/:id'");

    expect(client).toContain('/analytics/${engagementId}/metrics/calculate');
    expect(client).toContain('/analytics/organizations/${orgId}/attack-coverage/export-navigator');
    expect(client).toContain('/analytics/${engagementId}/ai/generate-summary');
    expect(client).toContain('/threat-pipeline${qs ? `?${qs}` : \'\'}');
    expect(client).toContain('/threat-pipeline/${id}');
  });
});
