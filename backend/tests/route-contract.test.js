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
});
