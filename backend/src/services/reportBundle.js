const pkg = require('../../package.json');
const {
  gatherPlanData,
  gatherExecutiveReportData,
  gatherTechnicalReportData,
  generatePlanDocument,
  generateExecutiveReport,
  generateTechnicalReport,
} = require('./documentGenerator');
const { getNavigatorLayer, getActionItemsCsv, toSlug } = require('./exportArtifacts');

function bundleFileName(engagementName, timestamp = new Date()) {
  const y = timestamp.getFullYear();
  const m = String(timestamp.getMonth() + 1).padStart(2, '0');
  const d = String(timestamp.getDate()).padStart(2, '0');
  const hh = String(timestamp.getHours()).padStart(2, '0');
  const mm = String(timestamp.getMinutes()).padStart(2, '0');
  return `purplekit_${toSlug(engagementName)}_${y}${m}${d}_${hh}${mm}.zip`;
}

async function buildReportBundle({ engagement, includeEngagementJson = false }) {
  const now = new Date();
  const planData = await gatherPlanData(engagement.id);
  const executiveData = await gatherExecutiveReportData(engagement.id);
  const technicalData = await gatherTechnicalReportData(engagement.id);

  const navigatorLayer = await getNavigatorLayer(engagement.id);

  const files = [
    { name: 'plan.docx', data: await generatePlanDocument(planData), encoding: null },
    { name: 'executive_report.docx', data: await generateExecutiveReport(executiveData), encoding: null },
    { name: 'technical_report.docx', data: await generateTechnicalReport(technicalData), encoding: null },
    { name: 'attack_navigator_layer.json', data: JSON.stringify(navigatorLayer, null, 2), encoding: 'utf8' },
    { name: 'action_items.csv', data: await getActionItemsCsv(engagement.id), encoding: 'utf8' },
  ];

  const included = files.map((file) => file.name);

  if (includeEngagementJson) {
    files.push({ name: 'engagement.json', data: JSON.stringify(engagement, null, 2), encoding: 'utf8' });
    included.push('engagement.json');
  }

  files.push({
    name: 'README.txt',
    encoding: 'utf8',
    data: [
      'PurpleKit Report Bundle',
      `Engagement ID: ${engagement.id}`,
      `Engagement Name: ${engagement.name}`,
      `Generated At: ${now.toISOString()}`,
      `PurpleKit Version: ${pkg.version}`,
      '',
      'Included files:',
      ...included.map((name) => `- ${name}`),
      '- README.txt',
      '',
    ].join('\n'),
  });

  return {
    files,
    filename: bundleFileName(engagement.name, now),
  };
}

module.exports = { buildReportBundle, bundleFileName };
