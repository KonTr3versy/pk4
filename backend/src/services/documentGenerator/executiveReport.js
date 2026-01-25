/**
 * Executive Report Generator
 *
 * Generates a DOCX executive report for stakeholder presentation
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
  OUTCOME_COLORS
} = require('./styles');

/**
 * Generate executive report document
 * @param {Object} data - Engagement data with stats and outcomes
 * @returns {Promise<Buffer>} - Document buffer
 */
async function generateExecutiveReport(data) {
  const {
    engagement,
    goals,
    roles,
    techniques,
    techniqueOutcomes,
    actionItems,
    stats
  } = data;

  const children = [];

  // Title Page
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'EXECUTIVE REPORT', bold: true, size: 48, color: COLORS.primary })],
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
    new Paragraph({
      children: [new TextRun({
        text: `This report summarizes the results of the purple team exercise "${engagement.name}" conducted from ${formatDate(engagement.start_date)} to ${formatDate(engagement.end_date)}.`
      })],
      spacing: { after: 200 }
    })
  );

  // Detection Rate Summary
  const detectionRate = stats.total > 0
    ? Math.round(((stats.prevented + stats.alerted) / stats.total) * 100)
    : 0;

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Overall Detection Rate: ', bold: true }),
        new TextRun({ text: `${detectionRate}%`, bold: true, color: detectionRate >= 70 ? COLORS.success : detectionRate >= 40 ? COLORS.warning : COLORS.danger })
      ],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Techniques Tested: ', bold: true }),
        new TextRun({ text: `${stats.total}` })
      ],
      spacing: { after: 200 }
    })
  );

  // Key metrics
  const criticalFindings = (actionItems || []).filter(a => a.severity === 'critical').length;
  const highFindings = (actionItems || []).filter(a => a.severity === 'high').length;

  if (criticalFindings > 0 || highFindings > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Critical Findings: ', bold: true }),
          new TextRun({ text: `${criticalFindings}`, color: COLORS.danger })
        ],
        spacing: { after: 50 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'High Severity Findings: ', bold: true }),
          new TextRun({ text: `${highFindings}`, color: 'DC2626' })
        ],
        spacing: { after: 200 }
      })
    );
  }

  // 2. Results Summary - Detection Scorecard
  children.push(
    createHeading('2. Results Summary'),
    new Paragraph({
      children: [new TextRun({ text: 'Detection Scorecard', bold: true, size: 24 })],
      spacing: { after: 150 }
    }),
    createDetectionScorecard(stats),
    new Paragraph({ spacing: { after: 200 } })
  );

  // Detection breakdown explanation
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Prevented: ', bold: true }),
        new TextRun({ text: 'Attack was blocked by security controls before execution completed.' })
      ],
      spacing: { after: 50 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Alerted: ', bold: true }),
        new TextRun({ text: 'Security tools generated an alert for SOC investigation.' })
      ],
      spacing: { after: 50 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Logged: ', bold: true }),
        new TextRun({ text: 'Activity was recorded in logs but did not generate an alert.' })
      ],
      spacing: { after: 50 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Not Logged: ', bold: true }),
        new TextRun({ text: 'No evidence of detection or logging was observed.' })
      ],
      spacing: { after: 200 }
    })
  );

  // 3. Key Findings
  children.push(
    createHeading('3. Key Findings'),
    actionItems && actionItems.length > 0
      ? createFindingsTable(actionItems)
      : new Paragraph({ children: [new TextRun({ text: 'No findings recorded', italics: true, color: COLORS.secondary })] }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 4. Recommendations
  children.push(
    createHeading('4. Recommendations'),
    ...createRecommendations(stats, actionItems),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 5. Maturity Assessment
  children.push(
    createHeading('5. Detection Maturity Assessment'),
    ...createMaturityAssessment(stats, techniqueOutcomes),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 6. Goals Assessment
  if (goals && goals.length > 0) {
    children.push(
      createHeading('6. Goals Assessment'),
      ...goals.map(goal =>
        new Paragraph({
          children: [
            new TextRun({ text: goal.is_primary ? 'Primary: ' : 'Secondary: ', bold: goal.is_primary }),
            new TextRun({ text: formatGoalType(goal.goal_type) }),
            goal.custom_text ? new TextRun({ text: ` - ${goal.custom_text}` }) : new TextRun('')
          ],
          spacing: { after: 100 }
        })
      ),
      new Paragraph({ spacing: { after: 200 } })
    );
  }

  // 7. Next Steps
  children.push(
    createHeading('7. Next Steps'),
    ...createNextSteps(actionItems),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 8. Appendix - Technique Results Summary
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    createHeading('Appendix A: Technique Results Summary'),
    techniqueOutcomes && techniqueOutcomes.length > 0
      ? createTechniqueResultsTable(techniqueOutcomes)
      : new Paragraph({ children: [new TextRun({ text: 'No technique results recorded', italics: true, color: COLORS.secondary })] })
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

function createDetectionScorecard(stats) {
  const headerRow = new TableRow({
    children: ['Outcome', 'Count', 'Percentage'].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLORS.white, size: 20 })] })],
        shading: { fill: COLORS.primary },
        width: { size: 33, type: WidthType.PERCENTAGE }
      })
    )
  });

  const total = stats.total || 1;
  const outcomes = [
    { name: 'Prevented', count: stats.prevented, color: OUTCOME_COLORS.prevented },
    { name: 'Alerted', count: stats.alerted, color: OUTCOME_COLORS.alerted },
    { name: 'Logged', count: stats.logged, color: OUTCOME_COLORS.logged },
    { name: 'Not Logged', count: stats.not_logged, color: OUTCOME_COLORS.not_logged }
  ];

  const dataRows = outcomes.map(outcome =>
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: outcome.name, bold: true, color: outcome.color, size: 20 })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: String(outcome.count), size: 20 })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: `${Math.round((outcome.count / total) * 100)}%`, size: 20 })] })]
        })
      ]
    })
  );

  // Total row
  const totalRow = new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: 'Total', bold: true, size: 20 })] })],
        shading: { fill: COLORS.light }
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(stats.total), bold: true, size: 20 })] })],
        shading: { fill: COLORS.light }
      }),
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: '100%', bold: true, size: 20 })] })],
        shading: { fill: COLORS.light }
      })
    ]
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [headerRow, ...dataRows, totalRow]
  });
}

function createFindingsTable(actionItems) {
  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const sortedItems = [...actionItems].sort((a, b) =>
    (severityOrder[a.severity] || 5) - (severityOrder[b.severity] || 5)
  );

  // Limit to top 10 for executive summary
  const topItems = sortedItems.slice(0, 10);

  const headerRow = new TableRow({
    children: ['Severity', 'Finding', 'Status'].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLORS.white, size: 18 })] })],
        shading: { fill: COLORS.primary }
      })
    )
  });

  const dataRows = topItems.map(item =>
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({
            text: (item.severity || 'info').toUpperCase(),
            bold: true,
            color: SEVERITY_COLORS[item.severity] || COLORS.secondary,
            size: 18
          })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: item.title || 'Untitled', size: 18 })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: formatStatus(item.status), size: 18 })] })]
        })
      ]
    })
  );

  if (sortedItems.length > 10) {
    dataRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: `... and ${sortedItems.length - 10} more findings`, italics: true, color: COLORS.secondary, size: 18 })] })],
            columnSpan: 3
          })
        ]
      })
    );
  }

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

function createRecommendations(stats, actionItems) {
  const recommendations = [];

  // Generate recommendations based on stats
  if (stats.not_logged > 0) {
    recommendations.push({
      priority: 1,
      text: `Improve logging coverage for ${stats.not_logged} technique(s) that generated no detection evidence. Consider deploying additional endpoint telemetry or enabling verbose logging.`
    });
  }

  if (stats.logged > stats.alerted) {
    recommendations.push({
      priority: 2,
      text: `Review detection rules for ${stats.logged} technique(s) that were logged but did not generate alerts. Tune detection thresholds or create new detection rules for these activities.`
    });
  }

  const detectionRate = stats.total > 0 ? ((stats.prevented + stats.alerted) / stats.total) : 0;
  if (detectionRate < 0.5) {
    recommendations.push({
      priority: 1,
      text: 'Detection coverage is below 50%. Consider conducting a gap analysis against MITRE ATT&CK to identify priority areas for detection engineering investment.'
    });
  }

  // Add recommendations from critical/high findings
  const criticalItems = (actionItems || []).filter(a => a.severity === 'critical');
  if (criticalItems.length > 0) {
    recommendations.push({
      priority: 1,
      text: `Address ${criticalItems.length} critical finding(s) as a top priority. These represent significant gaps in security controls.`
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 3,
      text: 'Continue regular purple team exercises to maintain and improve detection capabilities.'
    });
  }

  // Sort by priority and limit to 5
  recommendations.sort((a, b) => a.priority - b.priority);
  const topRecs = recommendations.slice(0, 5);

  return topRecs.map((rec, index) =>
    new Paragraph({
      children: [
        new TextRun({ text: `${index + 1}. `, bold: true }),
        new TextRun({ text: rec.text })
      ],
      spacing: { after: 100 }
    })
  );
}

function createMaturityAssessment(stats, techniqueOutcomes) {
  const total = stats.total || 1;
  const preventionRate = Math.round((stats.prevented / total) * 100);
  const alertRate = Math.round((stats.alerted / total) * 100);
  const visibilityRate = Math.round(((stats.prevented + stats.alerted + stats.logged) / total) * 100);

  let maturityLevel = 'Initial';
  let maturityDescription = '';

  if (visibilityRate >= 90 && preventionRate >= 50) {
    maturityLevel = 'Optimizing';
    maturityDescription = 'Excellent detection coverage with strong prevention capabilities. Focus on automation and continuous improvement.';
  } else if (visibilityRate >= 70 && (preventionRate + alertRate) >= 50) {
    maturityLevel = 'Managed';
    maturityDescription = 'Good detection coverage with room for improvement in prevention. Prioritize tuning and automation.';
  } else if (visibilityRate >= 50) {
    maturityLevel = 'Defined';
    maturityDescription = 'Moderate detection coverage. Focus on expanding logging and creating new detection rules.';
  } else if (visibilityRate >= 30) {
    maturityLevel = 'Developing';
    maturityDescription = 'Limited detection coverage. Prioritize foundational logging and basic detection capabilities.';
  } else {
    maturityLevel = 'Initial';
    maturityDescription = 'Minimal detection capabilities. Significant investment needed in logging infrastructure and detection engineering.';
  }

  return [
    new Paragraph({
      children: [
        new TextRun({ text: 'Current Maturity Level: ', bold: true }),
        new TextRun({ text: maturityLevel, bold: true, color: COLORS.primary })
      ],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: maturityDescription })],
      spacing: { after: 150 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Prevention Rate: ', bold: true }),
        new TextRun({ text: `${preventionRate}%` })
      ],
      spacing: { after: 50 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Alert Rate: ', bold: true }),
        new TextRun({ text: `${alertRate}%` })
      ],
      spacing: { after: 50 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Overall Visibility: ', bold: true }),
        new TextRun({ text: `${visibilityRate}%` })
      ],
      spacing: { after: 100 }
    })
  ];
}

function createNextSteps(actionItems) {
  const openItems = (actionItems || []).filter(a => a.status === 'open' || a.status === 'in_progress');

  const steps = [
    new Paragraph({
      children: [
        new TextRun({ text: '1. ', bold: true }),
        new TextRun({ text: `Review and prioritize ${openItems.length} open action item(s) from this exercise.` })
      ],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '2. ', bold: true }),
        new TextRun({ text: 'Schedule follow-up meeting with stakeholders to discuss findings and remediation timeline.' })
      ],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '3. ', bold: true }),
        new TextRun({ text: 'Assign owners and due dates for all critical and high severity findings.' })
      ],
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '4. ', bold: true }),
        new TextRun({ text: 'Plan next purple team exercise to validate remediation effectiveness.' })
      ],
      spacing: { after: 100 }
    })
  ];

  return steps;
}

function createTechniqueResultsTable(techniqueOutcomes) {
  const headerRow = new TableRow({
    children: ['Technique ID', 'Technique Name', 'Best Outcome'].map(text =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLORS.white, size: 18 })] })],
        shading: { fill: COLORS.primary }
      })
    )
  });

  const dataRows = techniqueOutcomes.map(tech => {
    // Determine best outcome
    let bestOutcome = 'Not Tested';
    let outcomeColor = COLORS.secondary;

    if (tech.outcomes && tech.outcomes.length > 0) {
      if (tech.outcomes.includes('prevented')) {
        bestOutcome = 'Prevented';
        outcomeColor = OUTCOME_COLORS.prevented;
      } else if (tech.outcomes.includes('alerted')) {
        bestOutcome = 'Alerted';
        outcomeColor = OUTCOME_COLORS.alerted;
      } else if (tech.outcomes.includes('logged')) {
        bestOutcome = 'Logged';
        outcomeColor = OUTCOME_COLORS.logged;
      } else if (tech.outcomes.includes('not_logged')) {
        bestOutcome = 'Not Logged';
        outcomeColor = OUTCOME_COLORS.not_logged;
      }
    }

    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: tech.technique_id || 'N/A', size: 18 })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: tech.technique_name || 'Unknown', size: 18 })] })]
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: bestOutcome, bold: true, color: outcomeColor, size: 18 })] })]
        })
      ]
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [headerRow, ...dataRows]
  });
}

module.exports = { generateExecutiveReport };
