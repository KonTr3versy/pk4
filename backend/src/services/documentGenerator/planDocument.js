/**
 * Plan Document Generator
 *
 * Generates a DOCX plan document for stakeholder approval
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
  PageBreak,
  BorderStyle
} = require('docx');

const {
  COLORS,
  PAGE_SIZE,
  PAGE_MARGINS,
  paragraphStyles,
  tableBorders
} = require('./styles');

/**
 * Generate plan document
 * @param {Object} data - Engagement data with all related entities
 * @returns {Promise<Buffer>} - Document buffer
 */
async function generatePlanDocument(data) {
  const {
    engagement,
    goals,
    roles,
    techniques,
    expectations,
    preparation,
    targets,
    infrastructure,
    threatActor
  } = data;

  const children = [];

  // Title Page
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'PURPLE TEAM EXERCISE PLAN', bold: true, size: 48, color: COLORS.primary })],
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
      children: [new TextRun({ text: 'CONFIDENTIAL', bold: true, size: 20, color: COLORS.danger })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString()}`, size: 18, color: COLORS.secondary })],
      alignment: AlignmentType.CENTER
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // 1. Executive Summary
  children.push(
    createHeading('1. Executive Summary'),
    createLabelValue('Exercise Name:', engagement.name),
    createLabelValue('Exercise Dates:', `${formatDate(engagement.start_date)} - ${formatDate(engagement.end_date)}`),
    createLabelValue('Methodology:', engagement.methodology === 'atomic' ? 'Atomic Testing' : 'Scenario-Based'),
    createLabelValue('Technique Count:', `${techniques?.length || 0} techniques`),
    createLabelValue('Status:', engagement.status),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 2. Goals and Objectives
  children.push(
    createHeading('2. Goals and Objectives'),
    ...(goals && goals.length > 0 ? goals.map(goal =>
      new Paragraph({
        children: [
          new TextRun({ text: goal.is_primary ? '● Primary: ' : '○ Secondary: ', bold: goal.is_primary }),
          new TextRun({ text: formatGoalType(goal.goal_type) }),
          goal.custom_text ? new TextRun({ text: ` - ${goal.custom_text}` }) : new TextRun('')
        ],
        spacing: { after: 100 }
      })
    ) : [new Paragraph({ children: [new TextRun({ text: 'No goals defined', italics: true, color: COLORS.secondary })] })]),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 3. Roles and Responsibilities
  children.push(
    createHeading('3. Roles and Responsibilities'),
    roles && roles.length > 0
      ? createRolesTable(roles)
      : new Paragraph({ children: [new TextRun({ text: 'No roles assigned', italics: true, color: COLORS.secondary })] }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 4. Adversary Profile
  if (threatActor || engagement.custom_threat_profile) {
    children.push(
      createHeading('4. Adversary Profile'),
      threatActor ? createLabelValue('Threat Actor:', threatActor.name) : null,
      threatActor?.aliases?.length > 0 ? createLabelValue('Aliases:', threatActor.aliases.join(', ')) : null,
      threatActor?.description ? new Paragraph({ children: [new TextRun({ text: threatActor.description })], spacing: { after: 100 } }) : null,
      engagement.custom_threat_profile ? new Paragraph({
        children: [new TextRun({ text: engagement.custom_threat_profile })]
      }) : null,
      new Paragraph({ spacing: { after: 200 } })
    ).filter(Boolean);
  }

  // 5. Technique Scope (Table Top Matrix)
  children.push(
    createHeading('5. Technique Scope'),
    techniques && techniques.length > 0
      ? createTechniquesTable(techniques, expectations)
      : new Paragraph({ children: [new TextRun({ text: 'No techniques defined', italics: true, color: COLORS.secondary })] }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 6. Target Environment
  children.push(
    createHeading('6. Target Environment'),
    targets && targets.length > 0
      ? createTargetsTable(targets)
      : new Paragraph({ children: [new TextRun({ text: 'No target systems defined', italics: true, color: COLORS.secondary })] }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 7. Attack Infrastructure
  children.push(
    createHeading('7. Attack Infrastructure'),
    infrastructure && infrastructure.length > 0
      ? createInfrastructureTable(infrastructure)
      : new Paragraph({ children: [new TextRun({ text: 'No attack infrastructure defined', italics: true, color: COLORS.secondary })] }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 8. Preparation Checklist
  children.push(
    createHeading('8. Preparation Checklist'),
    preparation && preparation.length > 0
      ? createPreparationTable(preparation)
      : new Paragraph({ children: [new TextRun({ text: 'No preparation items', italics: true, color: COLORS.secondary })] }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 9. Metrics to Capture
  children.push(
    createHeading('9. Metrics to Capture'),
    new Paragraph({ children: [new TextRun({ text: '● Time to Detect (TTD): ', bold: true }), new TextRun('Time from technique execution to initial detection')] }),
    new Paragraph({ children: [new TextRun({ text: '● Time to Investigate (TTI): ', bold: true }), new TextRun('Time from detection to understanding the scope')] }),
    new Paragraph({ children: [new TextRun({ text: '● Time to Contain (TTC): ', bold: true }), new TextRun('Time from investigation to containment')] }),
    new Paragraph({ children: [new TextRun({ text: '● Time to Remediate (TTR): ', bold: true }), new TextRun('Time from containment to full remediation')] }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 10. Approval Signatures
  children.push(
    createHeading('10. Approval Signatures'),
    createSignatureTable(roles)
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

function formatGoalType(type) {
  const labels = {
    'collaborative_culture': 'Build Collaborative Culture',
    'test_attack_chains': 'Test Attack Chains',
    'train_defenders': 'Train Defenders',
    'test_new_ttps': 'Test New TTPs',
    'red_team_replay': 'Red Team Replay',
    'test_processes': 'Test Processes',
    'custom': 'Custom Goal'
  };
  return labels[type] || type;
}

function createRolesTable(roles) {
  const headerRow = new TableRow({
    children: ['Role', 'Name', 'Email'].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLORS.white })] })],
        shading: { fill: COLORS.primary },
        width: { size: 33, type: WidthType.PERCENTAGE }
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
          children: [new Paragraph({ children: [new TextRun({ text: text || '' })] })]
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

function createTechniquesTable(techniques, expectations) {
  const expectationsMap = new Map();
  (expectations || []).forEach(exp => {
    expectationsMap.set(exp.technique_id, exp);
  });

  const headerRow = new TableRow({
    children: ['ID', 'Name', 'Tactic', 'Classification', 'SOC Visibility'].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLORS.white, size: 18 })] })],
        shading: { fill: COLORS.primary }
      })
    )
  });

  const dataRows = techniques.map(tech => {
    const exp = expectationsMap.get(tech.id) || {};
    return new TableRow({
      children: [
        tech.technique_id,
        tech.technique_name,
        tech.tactic,
        formatClassification(exp.classification),
        formatVisibility(exp.soc_visibility)
      ].map(text =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: text || 'N/A', size: 18 })] })]
        })
      )
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [headerRow, ...dataRows]
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
    children: ['Type', 'Name', 'IP/Domain', 'Allowlist Status'].map(text =>
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
        formatAllowlistStatus(infra.allowlist_status)
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

function formatAllowlistStatus(status) {
  const labels = {
    'pending': 'Pending',
    'approved': 'Approved',
    'denied': 'Denied',
    'not_needed': 'Not Needed'
  };
  return labels[status] || status;
}

function createPreparationTable(preparation) {
  const headerRow = new TableRow({
    children: ['Category', 'Item', 'Status', 'Assigned To'].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLORS.white, size: 18 })] })],
        shading: { fill: COLORS.primary }
      })
    )
  });

  const dataRows = preparation.map(item =>
    new TableRow({
      children: [
        formatPrepCategory(item.category),
        item.item,
        formatPrepStatus(item.status),
        item.assigned_to_name || 'Unassigned'
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

function formatPrepCategory(category) {
  const labels = {
    'target_systems': 'Target Systems',
    'security_tools': 'Security Tools',
    'attack_infra': 'Attack Infrastructure',
    'accounts': 'Accounts',
    'allowlists': 'Allowlists',
    'logistics': 'Logistics'
  };
  return labels[category] || category;
}

function formatPrepStatus(status) {
  const labels = {
    'pending': '⏳ Pending',
    'in_progress': '🔄 In Progress',
    'complete': '✓ Complete',
    'blocked': '⚠ Blocked'
  };
  return labels[status] || status;
}

function createSignatureTable(roles) {
  const approvalRoles = (roles || []).filter(r =>
    ['coordinator', 'sponsor', 'red_lead', 'blue_lead'].includes(r.role)
  );

  if (approvalRoles.length === 0) {
    return new Paragraph({
      children: [new TextRun({ text: 'No approval roles assigned', italics: true, color: COLORS.secondary })]
    });
  }

  const headerRow = new TableRow({
    children: ['Role', 'Name', 'Signature', 'Date'].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLORS.white })] })],
        shading: { fill: COLORS.primary },
        width: { size: 25, type: WidthType.PERCENTAGE }
      })
    )
  });

  const dataRows = approvalRoles.map(role =>
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: formatRoleType(role.role) })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: role.user_name || role.external_name || '' })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: '________________________' })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: '____________' })] })]
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

module.exports = { generatePlanDocument };
