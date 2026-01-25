# PurpleKit Document Workflow Specification

## Workflow Overview

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   PLAN PHASE    │ ───► │ EXECUTE PHASE   │ ───► │  REPORT PHASE   │
│                 │      │                 │      │                 │
│ • Create plan   │      │ • Track results │      │ • Executive     │
│ • Get approval  │      │ • Capture IOCs  │      │ • Technical     │
│ • Export DOCX   │      │ • Log findings  │      │ • Export DOCX   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        │                        │                        │
        ▼                        ▼                        ▼
   Plan Document           Active Engagement        Report Documents
   (stakeholder)           (in PurpleKit)          (exec + technical)
```

---

## Document 1: Purple Team Exercise Plan

**Purpose:** Get stakeholder approval before engagement begins
**Audience:** Sponsors, managers, team leads
**Format:** .docx (editable for comments/approval signatures)

### Document Structure

```
PURPLE TEAM EXERCISE PLAN
=========================

1. EXECUTIVE SUMMARY
   • Exercise name and dates
   • Primary goal (from PTEF goals)
   • Scope summary (# techniques, target systems)
   • Teams involved

2. GOALS AND OBJECTIVES (PTEF §2)
   • Primary goal
   • Secondary goals
   • Success criteria
   • Out of scope items

3. ROLES AND RESPONSIBILITIES (PTEF §4)
   ┌────────────────────┬────────────────┬─────────────────────────────┐
   │ Name               │ Role           │ Responsibility              │
   ├────────────────────┼────────────────┼─────────────────────────────┤
   │ Jane Smith         │ Coordinator    │ Lead, notes, report         │
   │ John Doe           │ Sponsor        │ Approve budget, goals       │
   │ Alice Red          │ Red Team Lead  │ Attack execution            │
   │ Bob Blue           │ Blue Team Lead │ Detection validation        │
   └────────────────────┴────────────────┴─────────────────────────────┘

4. ADVERSARY PROFILE (PTEF §6.5)
   • Threat actor name (if applicable)
   • Description
   • Target industries
   • Known tools
   • CTI references

5. TECHNIQUE SCOPE (PTEF §6.6 Table Top Matrix)
   ┌──────────────┬────────────┬─────────────────┬───────────────────┬─────────────┐
   │ Technique ID │ Name       │ Expected Result │ Expected Visibility│ Classification│
   ├──────────────┼────────────┼─────────────────┼───────────────────┼─────────────┤
   │ T1003.001    │ LSASS Mem  │ Process access  │ SOC: Alert        │ May Alert   │
   │ T1059.001    │ PowerShell │ Script block    │ Hunt: Telemetry   │ May Log     │
   │ T1218.011    │ Rundll32   │ Process create  │ SOC: Alert        │ May Alert   │
   └──────────────┴────────────┴─────────────────┴───────────────────┴─────────────┘

6. TARGET ENVIRONMENT
   • Systems in scope (hostname, OS, purpose)
   • Security tools deployed
   • Network segments
   • Accounts to be used

7. ATTACK INFRASTRUCTURE
   • Internal/External
   • C2 framework
   • Domains (if external)
   • IPs for allowlisting

8. PREPARATION CHECKLIST STATUS
   ┌────────────────────────────────────┬──────────┬─────────────┐
   │ Item                               │ Owner    │ Status      │
   ├────────────────────────────────────┼──────────┼─────────────┤
   │ Target systems provisioned         │ IT Ops   │ ✓ Complete  │
   │ EDR reporting verified             │ SOC      │ ✓ Complete  │
   │ C2 infrastructure tested           │ Red Team │ In Progress │
   │ Allowlists configured              │ NetSec   │ Pending     │
   └────────────────────────────────────┴──────────┴─────────────┘

9. SCHEDULE AND LOGISTICS
   • Exercise dates
   • Daily schedule
   • Location (physical/virtual)
   • Communication channels

10. METRICS TO CAPTURE (PTEF §5.1)
    • Time to Detect (TTD)
    • Time to Investigate (TTI)
    • Time to Contain (TTC)
    • Time to Remediate (TTR)
    • Detection method (alert/telemetry/hunt)

11. APPROVAL SIGNATURES
    ┌────────────────────┬────────────────┬──────────────┐
    │ Name               │ Role           │ Signature    │
    ├────────────────────┼────────────────┼──────────────┤
    │ John Doe           │ Sponsor        │ ____________ │
    │ Jane Smith         │ Coordinator    │ ____________ │
    │ Alice Red          │ Red Team Lead  │ ____________ │
    │ Bob Blue           │ Blue Team Lead │ ____________ │
    └────────────────────┴────────────────┴──────────────┘

APPENDIX A: Full Technique Details
(ATT&CK descriptions, procedures, data sources for each technique)

APPENDIX B: MITRE ATT&CK Navigator Export
(Visual coverage map - optional image embed)
```

---

## Document 2: Executive Report

**Purpose:** Show value to leadership
**Audience:** Executives, sponsors, non-technical stakeholders
**Format:** .docx (professional, concise)

### Document Structure

```
PURPLE TEAM EXERCISE REPORT
===========================
Executive Summary

1. EXECUTIVE SUMMARY
   • Exercise conducted: [dates]
   • Goal achieved: [Yes/Partial/No]
   • Overall detection rate: X/Y techniques (Z%)
   • Critical findings: [count]
   • Key recommendations: [top 3]

2. EXERCISE OVERVIEW
   • Original goals (from plan)
   • Threat actor emulated
   • Scope: X techniques across Y systems
   • Duration: Z hours

3. RESULTS SUMMARY
   ┌─────────────────────────────────────────────────────────────┐
   │                    DETECTION SCORECARD                      │
   ├─────────────────────────────────────────────────────────────┤
   │  Detected & Alerted    ██████████████████░░░░  70% (14/20) │
   │  Detected (telemetry)  ████░░░░░░░░░░░░░░░░░░  15% (3/20)  │
   │  Not Detected          ███░░░░░░░░░░░░░░░░░░░  15% (3/20)  │
   └─────────────────────────────────────────────────────────────┘

   Average Time to Detect: 4.2 minutes
   Average Time to Investigate: 12.8 minutes

4. KEY FINDINGS (High-Level)
   ┌──────────┬────────────────────────────────────┬──────────┐
   │ Severity │ Finding                            │ Status   │
   ├──────────┼────────────────────────────────────┼──────────┤
   │ Critical │ LSASS access not detected          │ Open     │
   │ High     │ PowerShell logging incomplete      │ Open     │
   │ Medium   │ Lateral movement alerts delayed    │ In Progress│
   └──────────┴────────────────────────────────────┴──────────┘

5. RECOMMENDATIONS
   Priority recommendations with business impact:
   1. Enable Credential Guard (prevents LSASS dumping)
   2. Deploy PowerShell Script Block Logging
   3. Tune lateral movement detection rules

6. MATURITY ASSESSMENT (PTEF §11)
   ┌─────────────────────┬─────────┬────────┐
   │ Dimension           │ Current │ Target │
   ├─────────────────────┼─────────┼────────┤
   │ Threat Understanding│ Level 1 │ Level 2│
   │ Detection Understanding│ Level 2│ Level 2│
   └─────────────────────┴─────────┴────────┘

7. TREND ANALYSIS (if previous exercises exist)
   • Detection rate: 55% → 70% (+15%)
   • Avg TTD: 8.5 min → 4.2 min (-50%)

8. NEXT STEPS
   • Action items summary (X items, Y owners)
   • Retest scheduled: [date]
   • Next exercise: [date]

APPENDIX: Technique Results Summary Table
(One-line per technique: ID, Name, Detected Y/N, Finding count)
```

---

## Document 3: Technical Findings Report

**Purpose:** Detailed technical data for improvement
**Audience:** Red team, blue team, detection engineers
**Format:** .docx (detailed, actionable)

### Document Structure

```
PURPLE TEAM EXERCISE
TECHNICAL FINDINGS REPORT
=========================

1. EXERCISE PARAMETERS
   • Dates: [start] - [end]
   • Threat actor: [name]
   • Attack infrastructure: [details]
   • Target systems: [list]

2. TECHNIQUE-BY-TECHNIQUE RESULTS

   ┌─────────────────────────────────────────────────────────────────┐
   │ T1003.001 - OS Credential Dumping: LSASS Memory                │
   ├─────────────────────────────────────────────────────────────────┤
   │ EXECUTION DETAILS                                               │
   │   Executed: 2024-01-15 14:32:15 UTC                            │
   │   Target: WORKSTATION-01 (10.1.2.50)                           │
   │   Attacker: 10.1.2.100                                         │
   │   Command: mimikatz.exe "sekurlsa::logonpasswords"             │
   │   Artifacts: C:\Temp\lsass.dmp                                 │
   ├─────────────────────────────────────────────────────────────────┤
   │ EXPECTED VS ACTUAL                                              │
   │   Expected: SOC Alert within 30 seconds                        │
   │   Actual: No alert generated                                   │
   ├─────────────────────────────────────────────────────────────────┤
   │ BLUE TEAM RESULTS                                               │
   │   Alert Received: ✗ No                                         │
   │   Telemetry Available: ✓ Yes (Sysmon Event 10)                │
   │   Hunt Query: process_access where target_name="lsass.exe"     │
   │   DFIR Artifacts: Memory dump file found                       │
   ├─────────────────────────────────────────────────────────────────┤
   │ TIMING METRICS                                                  │
   │   TTD: N/A (not detected via alert)                            │
   │   Manual discovery: 45 minutes (hunt)                          │
   ├─────────────────────────────────────────────────────────────────┤
   │ FINDINGS                                                        │
   │   [CRITICAL] LSASS access not generating EDR alert             │
   │     • Root cause: LSASS protection policy not enabled          │
   │     • Recommendation: Enable Credential Guard                  │
   │     • Owner: Endpoint Security Team                            │
   │     • Due: 2024-02-01                                          │
   ├─────────────────────────────────────────────────────────────────┤
   │ DETECTION ENGINEERING NOTES                                     │
   │   • Sysmon Event 10 is present but not forwarded to SIEM      │
   │   • Proposed Sigma rule: proc_access_lsass_suspicious.yml     │
   │   • Retest required after rule deployment                      │
   └─────────────────────────────────────────────────────────────────┘

   [Repeat for each technique...]

3. CONSOLIDATED FINDINGS TABLE
   ┌────┬──────────┬────────────────────────────────┬────────┬──────────┬──────────┐
   │ ID │ Severity │ Title                          │ Technique│ Owner   │ Due Date │
   ├────┼──────────┼────────────────────────────────┼─────────┼─────────┼──────────┤
   │ F1 │ Critical │ LSASS protection disabled      │ T1003.001│ EndSec │ 2/1/24   │
   │ F2 │ High     │ PS ScriptBlock not to SIEM     │ T1059.001│ SOC    │ 2/15/24  │
   │ F3 │ Medium   │ Rundll32 alert threshold high  │ T1218.011│ DetEng │ 2/28/24  │
   └────┴──────────┴────────────────────────────────┴─────────┴─────────┴──────────┘

4. ACTION ITEMS TRACKER
   ┌────┬────────────────────────────────┬────────┬──────────┬────────┬─────────┐
   │ ID │ Action                         │ Owner  │ Due Date │ Status │ Retest  │
   ├────┼────────────────────────────────┼────────┼──────────┼────────┼─────────┤
   │ A1 │ Enable Credential Guard        │ EndSec │ 2/1/24   │ Open   │ Required│
   │ A2 │ Forward Sysmon 10 to SIEM      │ SOC    │ 2/8/24   │ Open   │ Required│
   │ A3 │ Create LSASS access Sigma rule │ DetEng │ 2/15/24  │ Open   │ Required│
   └────┴────────────────────────────────┴────────┴──────────┴────────┴─────────┘

5. DETECTION ENGINEERING APPENDIX
   
   5.1 Recommended Sigma Rules
   
   ```yaml
   title: LSASS Memory Access
   status: experimental
   logsource:
     product: windows
     service: sysmon
   detection:
     selection:
       EventID: 10
       TargetImage|endswith: '\lsass.exe'
       GrantedAccess|contains:
         - '0x1010'
         - '0x1410'
     condition: selection
   ```

   5.2 Hunt Queries
   
   ```kql
   // LSASS Access Hunt
   DeviceProcessEvents
   | where TargetProcessName == "lsass.exe"
   | where ActionType == "ProcessAccessed"
   | project Timestamp, DeviceName, InitiatingProcessName, InitiatingProcessCommandLine
   ```

6. RED TEAM NOTES
   • Tools used: Mimikatz 2.2.0, Cobalt Strike 4.8
   • Evasion techniques attempted: [list]
   • What worked/didn't work: [notes]
   • Recommendations for future exercises

7. MITRE ATT&CK COVERAGE MAP
   [Navigator layer JSON or embedded image]

8. RAW DATA APPENDIX
   • Full command logs
   • Timestamps for all actions
   • IOC list for threat intel
```

---

## Database Schema Additions

```sql
-- Track document generation
CREATE TABLE engagement_documents (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  document_type VARCHAR(30) NOT NULL, -- 'plan', 'executive_report', 'technical_report'
  generated_at TIMESTAMP DEFAULT NOW(),
  generated_by INTEGER REFERENCES users(id),
  file_path TEXT, -- S3 or local path
  version INTEGER DEFAULT 1,
  
  -- Metadata
  page_count INTEGER,
  word_count INTEGER,
  
  UNIQUE(engagement_id, document_type, version)
);

-- Plan approval tracking
CREATE TABLE plan_approvals (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  role VARCHAR(30),
  approved_at TIMESTAMP,
  signature_text TEXT, -- Digital signature or typed name
  comments TEXT
);
```

---

## API Endpoints

```
# Plan Document
POST   /api/engagements/:id/documents/plan/generate
GET    /api/engagements/:id/documents/plan/download
POST   /api/engagements/:id/documents/plan/approve

# Convert Plan to Active Engagement  
POST   /api/engagements/:id/activate
       Body: { approved_by: [user_ids] }

# Executive Report
POST   /api/engagements/:id/documents/executive-report/generate
GET    /api/engagements/:id/documents/executive-report/download

# Technical Report
POST   /api/engagements/:id/documents/technical-report/generate
GET    /api/engagements/:id/documents/technical-report/download

# List all documents for engagement
GET    /api/engagements/:id/documents
```

---

## Engagement State Machine

```
┌─────────┐     Plan Doc      ┌──────────┐    Approvals    ┌────────┐
│ DRAFT   │ ───Generated───►  │ PLANNING │ ───Received───► │ READY  │
└─────────┘                   └──────────┘                 └────────┘
                                                                │
                                                           Activate
                                                                │
┌───────────┐   Reports Gen   ┌───────────┐   Start Exec   ┌────▼───┐
│ COMPLETED │ ◄───────────── │ REPORTING │ ◄───────────── │ ACTIVE │
└───────────┘                 └───────────┘                └────────┘
```

```sql
-- Update engagements table
ALTER TABLE engagements ADD COLUMN status VARCHAR(20) DEFAULT 'draft';
-- Values: 'draft', 'planning', 'ready', 'active', 'reporting', 'completed'

ALTER TABLE engagements ADD COLUMN plan_generated_at TIMESTAMP;
ALTER TABLE engagements ADD COLUMN activated_at TIMESTAMP;
ALTER TABLE engagements ADD COLUMN completed_at TIMESTAMP;
```

---

## UI Flow

### Plan Phase
```
┌─────────────────────────────────────────────────────────────────────┐
│ New Purple Team Exercise                                    [Draft] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Step 1: Goals ──► Step 2: Team ──► Step 3: Techniques ──►          │
│ Step 4: Systems ──► Step 5: Infrastructure ──► Step 6: Schedule    │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Progress: 4/6 steps complete                            [80%]  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [Save Draft]                      [Generate Plan Document]          │
└─────────────────────────────────────────────────────────────────────┘
```

### Approval Flow
```
┌─────────────────────────────────────────────────────────────────────┐
│ Exercise Plan Approval                                   [Planning] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Plan Document: PTE-2024-001-Plan.docx           [Download] [View]  │
│                                                                     │
│ Approvals Required:                                                 │
│ ┌───────────────────┬────────────────┬─────────────────────────────┐│
│ │ Role              │ Assignee       │ Status                      ││
│ ├───────────────────┼────────────────┼─────────────────────────────┤│
│ │ Sponsor           │ John Doe       │ ✓ Approved 1/15 2:30pm     ││
│ │ Coordinator       │ Jane Smith     │ ✓ Approved 1/15 3:00pm     ││
│ │ Red Team Lead     │ Alice Red      │ ⏳ Pending                  ││
│ │ Blue Team Lead    │ Bob Blue       │ ⏳ Pending                  ││
│ └───────────────────┴────────────────┴─────────────────────────────┘│
│                                                                     │
│ [Activate Engagement] (disabled until all approvals received)       │
└─────────────────────────────────────────────────────────────────────┘
```

### Reporting Phase
```
┌─────────────────────────────────────────────────────────────────────┐
│ Exercise Complete - Generate Reports                    [Reporting] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Exercise Summary:                                                   │
│ • 20 techniques executed                                           │
│ • 14 detected (70%)                                                │
│ • 8 findings documented                                            │
│ • 12 action items created                                          │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Executive Report                                                │ │
│ │ For: Leadership, sponsors                                       │ │
│ │ Content: High-level results, recommendations                    │ │
│ │                                           [Generate] [Download] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Technical Findings Report                                       │ │
│ │ For: Red team, blue team, detection engineers                   │ │
│ │ Content: Detailed technique results, Sigma rules, hunt queries  │ │
│ │                                           [Generate] [Download] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [Mark Exercise Complete]                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Plan Document (Week 1-2)
1. Engagement wizard with all plan fields
2. Plan document generator (docx-js)
3. Approval tracking UI
4. Activate engagement flow

### Phase 2: Report Documents (Week 3-4)
1. Executive report generator
2. Technical report generator
3. Reporting phase UI
4. Document history/versioning

### Phase 3: Polish (Week 5)
1. PDF export option
2. Document templates (customizable headers/footers)
3. ATT&CK Navigator image embedding
4. Email notifications for approvals

---

## Technical Implementation: docx-js Example

```javascript
// services/documentGenerator.js

const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        HeadingLevel, AlignmentType, BorderStyle, WidthType } = require('docx');

async function generatePlanDocument(engagement) {
  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 24 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal",
          run: { size: 32, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 240, after: 120 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal",
          run: { size: 28, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 200, after: 100 } } },
      ]
    },
    sections: [{
      properties: {
        page: { size: { width: 12240, height: 15840 } } // US Letter
      },
      children: [
        // Title
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [new TextRun("PURPLE TEAM EXERCISE PLAN")]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: engagement.name, bold: true, size: 28 })]
        }),
        
        // Executive Summary
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. Executive Summary")] }),
        new Paragraph({ children: [
          new TextRun({ text: "Exercise Dates: ", bold: true }),
          new TextRun(`${engagement.start_date} - ${engagement.end_date}`)
        ]}),
        new Paragraph({ children: [
          new TextRun({ text: "Primary Goal: ", bold: true }),
          new TextRun(engagement.primary_goal)
        ]}),
        
        // Techniques Table
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. Technique Scope")] }),
        createTechniquesTable(engagement.techniques),
        
        // ... more sections
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

function createTechniquesTable(techniques) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };
  
  const headerRow = new TableRow({
    children: ["ID", "Name", "Expected", "Visibility", "Class"].map(text =>
      new TableCell({
        borders,
        shading: { fill: "1a365d", type: "clear" },
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF" })] })]
      })
    )
  });

  const dataRows = techniques.map(t =>
    new TableRow({
      children: [t.attack_id, t.name, t.expected_result, t.visibility, t.classification].map(text =>
        new TableCell({
          borders,
          children: [new Paragraph({ children: [new TextRun(text || "")] })]
        })
      )
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows]
  });
}

module.exports = { generatePlanDocument };
```

---

## Next Steps

1. **Confirm document content** - Any sections to add/remove from the templates?
2. **Decide on PDF vs DOCX** - DOCX allows comments/signatures; PDF is more locked down
3. **Logo/branding** - Should documents include org logo? Configurable?
4. **Begin implementation** - Start with Plan Document generator?
