/**
 * Technical Report Generator
 *
 * Generates a detailed DOCX technical report for security teams
 */

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  PageBreak
} = require('docx');

const {
  COLORS,
  PAGE_SIZE,
  PAGE_MARGINS,
  paragraphStyles,
  tableBorders,
  SEVERITY_COLORS,
  STATUS_COLORS,
  OUTCOME_COLORS
} = require('./styles');

/**
 * Generate technical report document
 * @param {Object} data - Complete engagement data with results and comments
 * @returns {Promise<Buffer>} - Document buffer
 */
async function generateTechnicalReport(data) {
  const {
    engagement,
    goals,
    roles,
    techniques,
    expectations,
    targets,
    infrastructure,
    threatActor,
    techniqueOutcomes,
    actionItems,
    stats,
    results,
    comments
  } = data;

  const children = [];

  // Title Page
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'TECHNICAL REPORT', bold: true, size: 48, color: COLORS.primary })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 400 }
    }),
    new Paragraph({
      children: [new TextRun({ text: engagement.name || 'Untitled Engagement', size: 36, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `${formatDate(engagement.start_date)} - ${formatDate(engagement.end_date)}`, size: 24, color: COLORS.secondary })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 }
    }),
    new Paragraph({
      children: [new TextRun({ text: 'CONFIDENTIAL - FOR AUTHORIZED PERSONNEL ONLY', bold: true, size: 20, color: COLORS.danger })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString()}`, size: 18, color: COLORS.secondary })],
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // Table of Contents
  children.push(
    createHeading('Table of Contents'),
    createTOCEntry('1. Exercise Parameters', 1),
    createTOCEntry('2. Technique-by-Technique Results', 1),
    createTOCEntry('3. Consolidated Findings', 1),
    createTOCEntry('4. Action Items Tracker', 1),
    createTOCEntry('5. Detection Engineering Notes', 1),
    createTOCEntry('6. Red Team Notes', 1),
    createTOCEntry('7. ATT&CK Coverage Map', 1),
    createTOCEntry('Appendix A: IOCs and Raw Data', 1),
    new Paragraph({ children: [new PageBreak()] })
  );

  // 1. Exercise Parameters
  children.push(
    createHeading('1. Exercise Parameters'),
    createSubheading('1.1 General Information'),
    createLabelValue('Exercise Name:', engagement.name),
    createLabelValue('Start Date:', formatDate(engagement.start_date)),
    createLabelValue('End Date:', formatDate(engagement.end_date)),
    createLabelValue('Methodology:', engagement.methodology === 'atomic' ? 'Atomic Testing' : 'Scenario-Based'),
    createLabelValue('Status:', engagement.status),
    new Paragraph({ spacing: { after: 200 } })
  );

  // Threat Actor
  if (threatActor || engagement.custom_threat_profile) {
    children.push(
      createSubheading('1.2 Adversary Profile'),
      threatActor ? createLabelValue('Threat Actor:', threatActor.name) : null,
      threatActor?.aliases?.length > 0 ? createLabelValue('Aliases:', threatActor.aliases.join(', ')) : null,
      threatActor?.description ? new Paragraph({ children: [new TextRun({ text: threatActor.description })], spacing: { after: 100 } }) : null,
      engagement.custom_threat_profile ? new Paragraph({
        children: [new TextRun({ text: engagement.custom_threat_profile })]
      }) : null,
      new Paragraph({ spacing: { after: 200 } })
    );
  }

  // Target Systems
  children.push(
    createSubheading('1.3 Target Systems'),
    targets && targets.length > 0
      ? createTargetsTable(targets)
      : new Paragraph({ children: [new TextRun({ text: 'No target systems documented', italics: true, color: COLORS.secondary })] }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // Attack Infrastructure
  children.push(
    createSubheading('1.4 Attack Infrastructure'),
    infrastructure && infrastructure.length > 0
      ? createInfrastructureTable(infrastructure)
      : new Paragraph({ children: [new TextRun({ text: 'No attack infrastructure documented', italics: true, color: COLORS.secondary })] }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // Team Roles
  children.push(
    createSubheading('1.5 Team Composition'),
    roles && roles.length > 0
      ? createRolesTable(roles)
      : new Paragraph({ children: [new TextRun({ text: 'No roles assigned', italics: true, color: COLORS.secondary })] }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 2. Technique-by-Technique Results
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    createHeading('2. Technique-by-Technique Results')
  );

  // Build expectations map
  const expectationsMap = new Map();
  (expectations || []).forEach(exp => {
    expectationsMap.set(exp.technique_id, exp);
  });

  // Build results map
  const resultsMap = new Map();
  (results || []).forEach(result => {
    if (!resultsMap.has(result.technique_id)) {
      resultsMap.set(result.technique_id, []);
    }
    resultsMap.get(result.technique_id).push(result);
  });

  // Build comments map
  const commentsMap = new Map();
  (comments || []).forEach(comment => {
    if (!commentsMap.has(comment.technique_id)) {
      commentsMap.set(comment.technique_id, []);
    }
    commentsMap.get(comment.technique_id).push(comment);
  });

  // Build outcomes map
  const outcomesMap = new Map();
  (techniqueOutcomes || []).forEach(outcome => {
    outcomesMap.set(outcome.id, outcome);
  });

  if (techniques && techniques.length > 0) {
    techniques.forEach((tech, index) => {
      const exp = expectationsMap.get(tech.id) || {};
      const techResults = resultsMap.get(tech.id) || [];
      const techComments = commentsMap.get(tech.id) || [];
      const outcome = outcomesMap.get(tech.id) || {};

      children.push(
        createSubheading(`2.${index + 1} ${tech.technique_id}: ${tech.technique_name}`),
        createLabelValue('Tactic:', tech.tactic || 'Unknown'),
        createLabelValue('Description:', tech.description || 'No description'),
        new Paragraph({ spacing: { after: 100 } })
      );

      // Expected vs Actual
      children.push(
        new Paragraph({ children: [new TextRun({ text: 'Expected Outcome:', bold: true, size: 22 })], spacing: { after: 50 } }),
        createLabelValue('  Classification:', formatClassification(exp.classification)),
        createLabelValue('  SOC Visibility:', formatVisibility(exp.soc_visibility)),
        createLabelValue('  Expected Data Sources:', exp.expected_data_sources || 'Not specified'),
        new Paragraph({ spacing: { after: 100 } })
      );

      // Actual Results
      children.push(
        new Paragraph({ children: [new TextRun({ text: 'Actual Results:', bold: true, size: 22 })], spacing: { after: 50 } })
      );

      if (techResults.length > 0) {
        techResults.forEach(result => {
          children.push(
            createLabelValue('  Execution Time:', result.executed_at ? formatDateTime(result.executed_at) : 'Not recorded'),
            createLabelValue('  Detection Time:', result.detected_at ? formatDateTime(result.detected_at) : 'Not detected'),
            createLabelValue('  Time to Detect:', calculateTTD(result.executed_at, result.detected_at)),
            result.hunt_query ? createLabelValue('  Hunt Query:', result.hunt_query) : null,
            result.iocs ? createLabelValue('  IOCs:', result.iocs) : null,
            new Paragraph({ spacing: { after: 50 } })
          );
        });
      } else {
        children.push(
          new Paragraph({ children: [new TextRun({ text: '  No execution results recorded', italics: true, color: COLORS.secondary })], spacing: { after: 50 } })
        );
      }

      // Outcome summary
      if (outcome.outcomes && outcome.outcomes.length > 0) {
        const bestOutcome = getBestOutcome(outcome.outcomes);
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Detection Outcome: ', bold: true }),
              new TextRun({ text: bestOutcome, bold: true, color: getOutcomeColor(bestOutcome) })
            ],
            spacing: { after: 100 }
          })
        );
      }

      // Notes from expectations
      if (exp.notes) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Notes: ', bold: true }),
              new TextRun({ text: exp.notes })
            ],
            spacing: { after: 100 }
          })
        );
      }

      children.push(new Paragraph({ spacing: { after: 200 } }));
    });
  } else {
    children.push(
      new Paragraph({ children: [new TextRun({ text: 'No techniques defined', italics: true, color: COLORS.secondary })] })
    );
  }

  // 3. Consolidated Findings
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    createHeading('3. Consolidated Findings'),
    actionItems && actionItems.length > 0
      ? createDetailedFindingsTable(actionItems)
      : new Paragraph({ children: [new TextRun({ text: 'No findings recorded', italics: true, color: COLORS.secondary })] }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 4. Action Items Tracker
  children.push(
    createHeading('4. Action Items Tracker'),
    createActionItemsSummary(actionItems),
    actionItems && actionItems.length > 0
      ? createActionItemsTable(actionItems)
      : new Paragraph({ children: [new TextRun({ text: 'No action items', italics: true, color: COLORS.secondary })] }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 5. Detection Engineering Notes
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    createHeading('5. Detection Engineering Notes'),
    ...createDetectionEngineeringSection(results),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 6. Red Team Notes
  children.push(
    createHeading('6. Red Team Notes'),
    comments && comments.length > 0
      ? createCommentsSection(comments)
      : new Paragraph({ children: [new TextRun({ text: 'No comments recorded during exercise', italics: true, color: COLORS.secondary })] }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 7. ATT&CK Coverage Map
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    createHeading('7. ATT&CK Coverage Map'),
    ...createAttackCoverageSection(techniques, techniqueOutcomes),
    new Paragraph({ spacing: { after: 200 } })
  );

  // Appendix A: IOCs and Raw Data
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    createHeading('Appendix A: IOCs and Raw Data'),
    ...createIOCsSection(results),
    new Paragraph({ spacing: { after: 200 } })
  );

  const doc = new Document({
    styles: {
      paragraphStyles: paragraphStyles
    },
    sections: [{
      properties: {
        page: {
          size: PAGE_SIZE,
          margin: PAGE_MARGINS
        }
      },
      children: children.filter(Boolean)
    }]
  });

  return await Packer.toBuffer(doc);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 28 })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 150 }
  });
}

function createSubheading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color: COLORS.dark })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 }
  });
}

function createTOCEntry(text, level) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 50 },
    indent: { left: (level - 1) * 400 }
  });
}

function createLabelValue(label, value) {
  return new Paragraph({
    children: [
      new TextRun({ text: label + ' ', bold: true }),
      new TextRun({ text: value || 'N/A' })
    ],
    spacing: { after: 80 }
  });
}

function formatDate(date) {
  if (!date) return 'TBD';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDateTime(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatClassification(classification) {
  const labels = {
    'not_blocked': 'Not Blocked',
    'may_log': 'May Log',
    'may_alert': 'May Alert',
    'unknown': 'Unknown'
  };
  return labels[classification] || 'Unknown';
}

function formatVisibility(visibility) {
  const labels = {
    'alert': 'Alert Expected',
    'telemetry': 'Telemetry Only',
    'none': 'No Visibility',
    'unknown': 'Unknown'
  };
  return labels[visibility] || 'Unknown';
}

function calculateTTD(executedAt, detectedAt) {
  if (!executedAt || !detectedAt) return 'N/A';
  const executed = new Date(executedAt);
  const detected = new Date(detectedAt);
  const diffMs = detected - executed;
  if (diffMs < 0) return 'Invalid';

  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function getBestOutcome(outcomes) {
  if (outcomes.includes('prevented')) return 'Prevented';
  if (outcomes.includes('alerted')) return 'Alerted';
  if (outcomes.includes('logged')) return 'Logged';
  if (outcomes.includes('not_logged')) return 'Not Logged';
  return 'Unknown';
}

function getOutcomeColor(outcome) {
  const colors = {
    'Prevented': OUTCOME_COLORS.prevented,
    'Alerted': OUTCOME_COLORS.alerted,
    'Logged': OUTCOME_COLORS.logged,
    'Not Logged': OUTCOME_COLORS.not_logged
  };
  return colors[outcome] || COLORS.secondary;
}

function createTargetsTable(targets) {
  const headerRow = new TableRow({
    children: ['Hostname', 'IP', 'OS', 'Purpose', 'Security Tools'].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLORS.white, size: 18 })] })],
        shading: { fill: COLORS.primary }
      })
    )
  });

  const dataRows = targets.map(target =>
    new TableRow({
      children: [
        target.hostname,
        target.ip_address,
        `${target.os_type || ''} ${target.os_version || ''}`.trim(),
        target.purpose,
        (target.security_tools || []).join(', ')
      ].map(text =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: text || 'N/A', size: 18 })] })]
        })
      )
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [headerRow, ...dataRows]
  });
}

function createInfrastructureTable(infrastructure) {
  const headerRow = new TableRow({
    children: ['Type', 'Name', 'IP/Domain', 'Purpose'].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLORS.white, size: 18 })] })],
        shading: { fill: COLORS.primary }
      })
    )
  });

  const dataRows = infrastructure.map(infra =>
    new TableRow({
      children: [
        formatInfraType(infra.infra_type),
        infra.name,
        infra.ip_address || infra.domain || 'N/A',
        infra.purpose || 'N/A'
      ].map(text =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: text || 'N/A', size: 18 })] })]
        })
      )
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [headerRow, ...dataRows]
  });
}

function formatInfraType(type) {
  const labels = {
    'c2_server': 'C2 Server',
    'payload_host': 'Payload Host',
    'exfil_server': 'Exfil Server',
    'redirector': 'Redirector',
    'phishing': 'Phishing',
    'other': 'Other'
  };
  return labels[type] || type;
}

function createRolesTable(roles) {
  const headerRow = new TableRow({
    children: ['Role', 'Name', 'Contact'].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLORS.white, size: 18 })] })],
        shading: { fill: COLORS.primary }
      })
    )
  });

  const dataRows = roles.map(role =>
    new TableRow({
      children: [
        formatRoleType(role.role),
        role.user_name || role.external_name || 'Unassigned',
        role.external_email || ''
      ].map(text =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: text || '', size: 18 })] })]
        })
      )
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [headerRow, ...dataRows]
  });
}

function formatRoleType(type) {
  const labels = {
    'coordinator': 'Coordinator',
    'sponsor': 'Sponsor',
    'cti': 'CTI Lead',
    'red_lead': 'Red Team Lead',
    'red_team': 'Red Team',
    'blue_lead': 'Blue Team Lead',
    'soc': 'SOC',
    'hunt': 'Threat Hunt',
    'dfir': 'DFIR',
    'spectator': 'Spectator'
  };
  return labels[type] || type;
}

function createDetailedFindingsTable(actionItems) {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const sortedItems = [...actionItems].sort((a, b) =>
    (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5)
  );

  const headerRow = new TableRow({
    children: ['Severity', 'Finding', 'Description', 'Status', 'Owner'].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLORS.white, size: 16 })] })],
        shading: { fill: COLORS.primary }
      })
    )
  });

  const dataRows = sortedItems.map(item =>
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({
            text: (item.severity || 'info').toUpperCase(),
            bold: true,
            color: SEVERITY_COLORS[item.severity] || COLORS.secondary,
            size: 16
          })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item.title || 'Untitled', size: 16 })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: (item.description || '').substring(0, 100) + (item.description?.length > 100 ? '...' : ''), size: 16 })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({
            text: formatStatus(item.status),
            color: STATUS_COLORS[item.status] || COLORS.secondary,
            size: 16
          })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item.owner_name || 'Unassigned', size: 16 })] })]
        })
      ]
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [headerRow, ...dataRows]
  });
}

function formatStatus(status) {
  const labels = {
    'open': 'Open',
    'in_progress': 'In Progress',
    'complete': 'Complete',
    'wont_fix': "Won't Fix"
  };
  return labels[status] || status || 'Open';
}

function createActionItemsSummary(actionItems) {
  const items = actionItems || [];
  const open = items.filter(a => a.status === 'open').length;
  const inProgress = items.filter(a => a.status === 'in_progress').length;
  const complete = items.filter(a => a.status === 'complete').length;

  return new Paragraph({
    children: [
      new TextRun({ text: 'Summary: ', bold: true }),
      new TextRun({ text: `${items.length} total - ` }),
      new TextRun({ text: `${open} open`, color: STATUS_COLORS.open }),
      new TextRun({ text: ' | ' }),
      new TextRun({ text: `${inProgress} in progress`, color: STATUS_COLORS.in_progress }),
      new TextRun({ text: ' | ' }),
      new TextRun({ text: `${complete} complete`, color: STATUS_COLORS.complete })
    ],
    spacing: { after: 150 }
  });
}

function createActionItemsTable(actionItems) {
  const headerRow = new TableRow({
    children: ['ID', 'Title', 'Severity', 'Status', 'Owner', 'Due Date'].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLORS.white, size: 16 })] })],
        shading: { fill: COLORS.primary }
      })
    )
  });

  const dataRows = actionItems.map((item, index) =>
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: `AI-${index + 1}`, size: 16 })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item.title || 'Untitled', size: 16 })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({
            text: (item.severity || 'info').toUpperCase(),
            bold: true,
            color: SEVERITY_COLORS[item.severity] || COLORS.secondary,
            size: 16
          })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({
            text: formatStatus(item.status),
            color: STATUS_COLORS[item.status] || COLORS.secondary,
            size: 16
          })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item.owner_name || 'Unassigned', size: 16 })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item.due_date ? formatDate(item.due_date) : 'Not set', size: 16 })] })]
        })
      ]
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [headerRow, ...dataRows]
  });
}

function createDetectionEngineeringSection(results) {
  const huntQueries = (results || []).filter(r => r.hunt_query);

  if (huntQueries.length === 0) {
    return [
      new Paragraph({
        children: [new TextRun({ text: 'No hunt queries documented during this exercise.', italics: true, color: COLORS.secondary })]
      })
    ];
  }

  const paragraphs = [
    new Paragraph({
      children: [new TextRun({ text: 'The following hunt queries were used or developed during this exercise:', size: 22 })],
      spacing: { after: 150 }
    })
  ];

  huntQueries.forEach((result, index) => {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: `Query ${index + 1}: ${result.attack_id || 'Unknown Technique'}`, bold: true })],
        spacing: { before: 100, after: 50 }
      }),
      new Paragraph({
        children: [new TextRun({ text: result.hunt_query, font: 'Courier New', size: 18 })],
        spacing: { after: 100 },
        shading: { fill: COLORS.light }
      })
    );
  });

  return paragraphs;
}

function createCommentsSection(comments) {
  // Group by technique
  const byTechnique = new Map();
  comments.forEach(comment => {
    const key = comment.attack_id || 'general';
    if (!byTechnique.has(key)) {
      byTechnique.set(key, []);
    }
    byTechnique.get(key).push(comment);
  });

  const paragraphs = [];

  byTechnique.forEach((techComments, techniqueId) => {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: `Technique: ${techniqueId}`, bold: true, size: 22 })],
        spacing: { before: 150, after: 100 }
      })
    );

    techComments.forEach(comment => {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${formatDateTime(comment.created_at)}] `, color: COLORS.secondary, size: 18 }),
            new TextRun({ text: `${comment.user_name || 'Unknown'}: `, bold: true, size: 20 }),
            new TextRun({ text: comment.comment || '', size: 20 })
          ],
          spacing: { after: 50 }
        })
      );
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: paragraphs,
            shading: { fill: COLORS.light }
          })
        ]
      })
    ]
  });
}

function createAttackCoverageSection(techniques, techniqueOutcomes) {
  // Group techniques by tactic
  const byTactic = new Map();
  (techniques || []).forEach(tech => {
    const tactic = tech.tactic || 'Unknown';
    if (!byTactic.has(tactic)) {
      byTactic.set(tactic, []);
    }
    byTactic.get(tactic).push(tech);
  });

  const paragraphs = [
    new Paragraph({
      children: [new TextRun({ text: `Total Techniques Tested: ${techniques?.length || 0}`, bold: true })],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Tactics Covered: ${byTactic.size}`, bold: true })],
      spacing: { after: 150 }
    })
  ];

  // Create coverage table
  const headerRow = new TableRow({
    children: ['Tactic', 'Techniques Tested', 'Detected', 'Coverage'].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLORS.white, size: 18 })] })],
        shading: { fill: COLORS.primary }
      })
    )
  });

  const outcomesMap = new Map();
  (techniqueOutcomes || []).forEach(o => outcomesMap.set(o.id, o));

  const dataRows = [];
  byTactic.forEach((techs, tactic) => {
    const detected = techs.filter(t => {
      const outcome = outcomesMap.get(t.id);
      return outcome && (outcome.outcomes?.includes('prevented') || outcome.outcomes?.includes('alerted'));
    }).length;

    const coverage = techs.length > 0 ? Math.round((detected / techs.length) * 100) : 0;

    dataRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: tactic, size: 18 })] })]
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: String(techs.length), size: 18 })] })]
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: String(detected), size: 18 })] })]
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({
              text: `${coverage}%`,
              size: 18,
              color: coverage >= 70 ? COLORS.success : coverage >= 40 ? COLORS.warning : COLORS.danger
            })] })]
          })
        ]
      })
    );
  });

  paragraphs.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: tableBorders,
      rows: [headerRow, ...dataRows]
    })
  );

  return paragraphs;
}

function createIOCsSection(results) {
  const iocs = (results || []).filter(r => r.iocs);

  if (iocs.length === 0) {
    return [
      new Paragraph({
        children: [new TextRun({ text: 'No IOCs documented during this exercise.', italics: true, color: COLORS.secondary })]
      })
    ];
  }

  const paragraphs = [
    new Paragraph({
      children: [new TextRun({ text: 'The following indicators of compromise were generated or observed:', size: 22 })],
      spacing: { after: 150 }
    })
  ];

  iocs.forEach(result => {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: `${result.attack_id || 'Unknown'}:`, bold: true })],
        spacing: { before: 100, after: 50 }
      }),
      new Paragraph({
        children: [new TextRun({ text: result.iocs, font: 'Courier New', size: 18 })],
        spacing: { after: 100 },
        shading: { fill: COLORS.light }
      })
    );
  });

  return paragraphs;
}

module.exports = { generateTechnicalReport };
