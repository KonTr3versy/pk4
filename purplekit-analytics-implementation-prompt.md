# PurpleKit Analytics & Reporting Enhancement Implementation

## Context

You are implementing advanced analytics and reporting features for **PurpleKit**, a purple team operations platform. The goal is to combine VECTR's detection-focused metrics with PlexTrac's report polish, plus unique risk quantification capabilities.

### Existing Stack
- **Frontend:** React 18 + Tailwind CSS + Vite
- **Backend:** Node.js + Express.js
- **Database:** PostgreSQL
- **Auth:** JWT-based authentication
- **Monorepo:** Turborepo (`apps/web`, `apps/api`, `packages/shared`)

### Existing Tables (relevant)
- `engagements` - Exercise metadata
- `engagement_techniques` - Techniques assigned to engagements
- `findings` - Issues discovered during exercises
- `users`, `organizations` - Auth/multi-tenancy

---

## Database Schema

### Per-Tool Outcome Tracking

```sql
-- Security tools in the organization's stack
CREATE TABLE security_tools (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- 'CrowdStrike Falcon', 'Splunk Enterprise'
  category VARCHAR(30) NOT NULL, -- 'edr', 'siem', 'email_gateway', 'firewall', 'ndr', 'waf', 'casb', 'iam'
  vendor VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Outcome per tool per technique execution
CREATE TABLE technique_tool_outcomes (
  id SERIAL PRIMARY KEY,
  engagement_technique_id INTEGER REFERENCES engagement_techniques(id) ON DELETE CASCADE,
  security_tool_id INTEGER REFERENCES security_tools(id) ON DELETE CASCADE,
  
  outcome VARCHAR(30) NOT NULL,
  -- Values: 'blocked', 'alerted_high', 'alerted_medium', 'alerted_low', 
  --         'logged_central', 'logged_local', 'not_detected', 'not_applicable'
  
  alert_name VARCHAR(255),
  alert_id VARCHAR(100),
  alert_severity VARCHAR(20),
  response_time_seconds INTEGER, -- Time from execution to alert/block
  
  detection_logic TEXT, -- What rule/signature triggered
  notes TEXT,
  
  recorded_by INTEGER REFERENCES users(id),
  recorded_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(engagement_technique_id, security_tool_id)
);

-- Outcome weight for scoring (configurable)
CREATE TABLE outcome_weights (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  outcome VARCHAR(30) NOT NULL,
  weight DECIMAL(3,2) NOT NULL, -- 1.0 = full credit, 0.5 = partial, 0 = none
  
  UNIQUE(organization_id, outcome)
);

-- Default weights
INSERT INTO outcome_weights (organization_id, outcome, weight) VALUES
  (NULL, 'blocked', 1.0),
  (NULL, 'alerted_high', 0.9),
  (NULL, 'alerted_medium', 0.75),
  (NULL, 'alerted_low', 0.6),
  (NULL, 'logged_central', 0.4),
  (NULL, 'logged_local', 0.2),
  (NULL, 'not_detected', 0.0),
  (NULL, 'not_applicable', NULL);
```

### Engagement Metrics

```sql
-- Calculated metrics snapshot per engagement
CREATE TABLE engagement_metrics (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  
  -- Counts
  total_techniques INTEGER NOT NULL,
  techniques_blocked INTEGER DEFAULT 0,
  techniques_alerted INTEGER DEFAULT 0,
  techniques_logged_only INTEGER DEFAULT 0,
  techniques_not_detected INTEGER DEFAULT 0,
  
  -- Scores (0-100)
  threat_resilience_score DECIMAL(5,2), -- Weighted score based on outcomes
  prevention_rate DECIMAL(5,2), -- blocked / total * 100
  detection_rate DECIMAL(5,2), -- (blocked + alerted) / total * 100
  visibility_rate DECIMAL(5,2), -- (blocked + alerted + logged) / total * 100
  
  -- Timing (seconds)
  avg_time_to_detect INTEGER,
  median_time_to_detect INTEGER,
  min_time_to_detect INTEGER,
  max_time_to_detect INTEGER,
  avg_time_to_investigate INTEGER,
  
  -- Per-tactic breakdown (JSONB)
  tactic_scores JSONB, -- {"initial_access": {"score": 85, "tested": 3, "detected": 2}, ...}
  
  -- Per-tool breakdown (JSONB)
  tool_scores JSONB, -- {"crowdstrike": {"score": 90, "tested": 15, "detected": 12}, ...}
  
  calculated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(engagement_id)
);

-- Tool efficacy per engagement
CREATE TABLE engagement_tool_efficacy (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  security_tool_id INTEGER REFERENCES security_tools(id) ON DELETE CASCADE,
  
  techniques_applicable INTEGER,
  techniques_blocked INTEGER,
  techniques_alerted INTEGER,
  techniques_logged INTEGER,
  techniques_missed INTEGER,
  
  efficacy_score DECIMAL(5,2), -- Weighted detection rate for this tool
  avg_response_time_seconds INTEGER,
  
  UNIQUE(engagement_id, security_tool_id)
);
```

### Historical Trending

```sql
-- Point-in-time snapshots for trending
CREATE TABLE metric_snapshots (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  engagement_id INTEGER REFERENCES engagements(id),
  snapshot_date DATE NOT NULL,
  
  -- Core metrics
  threat_resilience_score DECIMAL(5,2),
  prevention_rate DECIMAL(5,2),
  detection_rate DECIMAL(5,2),
  visibility_rate DECIMAL(5,2),
  avg_time_to_detect INTEGER,
  
  -- Coverage
  techniques_tested INTEGER,
  attack_coverage_percent DECIMAL(5,2), -- % of ATT&CK tested
  
  -- Breakdowns
  tactic_scores JSONB,
  tool_scores JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- ATT&CK technique coverage tracking
CREATE TABLE attack_coverage (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  technique_id VARCHAR(20) NOT NULL, -- T1003.001
  
  -- Latest results
  last_tested_at TIMESTAMP,
  last_engagement_id INTEGER REFERENCES engagements(id),
  last_outcome VARCHAR(30),
  
  -- Aggregate stats
  times_tested INTEGER DEFAULT 0,
  times_blocked INTEGER DEFAULT 0,
  times_alerted INTEGER DEFAULT 0,
  times_logged INTEGER DEFAULT 0,
  times_missed INTEGER DEFAULT 0,
  
  -- Calculated
  historical_detection_rate DECIMAL(5,2),
  
  -- Status
  coverage_status VARCHAR(20) DEFAULT 'untested',
  -- Values: 'tested_pass', 'tested_partial', 'tested_fail', 'untested', 'not_applicable'
  
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(organization_id, technique_id)
);
```

### Detection Rule Recommendations

```sql
-- Auto-generated detection rules for gaps
CREATE TABLE detection_rules (
  id SERIAL PRIMARY KEY,
  technique_id VARCHAR(20) NOT NULL,
  
  rule_type VARCHAR(30) NOT NULL, -- 'sigma', 'splunk_spl', 'elastic_kql', 'sentinel_kql', 'chronicle_yara_l', 'yara'
  rule_name VARCHAR(255) NOT NULL,
  rule_content TEXT NOT NULL,
  
  -- Metadata
  data_sources_required TEXT[], -- ['process_creation', 'network_connection']
  log_sources TEXT[], -- ['sysmon_event_1', 'windows_security_4688']
  mitre_data_sources TEXT[], -- Official ATT&CK data source names
  
  confidence VARCHAR(20) DEFAULT 'medium', -- 'high', 'medium', 'low'
  severity VARCHAR(20) DEFAULT 'medium',
  false_positive_likelihood VARCHAR(20), -- 'high', 'medium', 'low'
  false_positive_notes TEXT,
  
  -- Source
  source VARCHAR(50), -- 'sigma_community', 'elastic_rules', 'custom', 'ai_generated'
  source_url TEXT,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Link findings to recommended rules
CREATE TABLE finding_detection_rules (
  id SERIAL PRIMARY KEY,
  finding_id INTEGER REFERENCES findings(id) ON DELETE CASCADE,
  detection_rule_id INTEGER REFERENCES detection_rules(id) ON DELETE CASCADE,
  
  -- Implementation tracking
  implementation_status VARCHAR(20) DEFAULT 'recommended',
  -- Values: 'recommended', 'in_progress', 'implemented', 'rejected'
  
  implemented_by INTEGER REFERENCES users(id),
  implemented_at TIMESTAMP,
  rejection_reason TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(finding_id, detection_rule_id)
);
```

### Risk Quantification (FAIR-aligned)

```sql
-- Organization risk parameters
CREATE TABLE risk_parameters (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Asset values
  avg_employee_hourly_cost DECIMAL(10,2) DEFAULT 75.00,
  avg_downtime_cost_per_hour DECIMAL(12,2),
  data_record_value DECIMAL(10,2) DEFAULT 150.00, -- Per PII record
  
  -- Industry context
  industry VARCHAR(50),
  annual_revenue DECIMAL(15,2),
  employee_count INTEGER,
  
  -- Regulatory context
  regulatory_frameworks TEXT[], -- ['hipaa', 'pci_dss', 'gdpr']
  max_regulatory_fine DECIMAL(15,2),
  
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(organization_id)
);

-- Risk quantification per finding
CREATE TABLE finding_risk_quantification (
  id SERIAL PRIMARY KEY,
  finding_id INTEGER REFERENCES findings(id) ON DELETE CASCADE,
  
  -- FAIR: Threat Event Frequency (TEF)
  threat_event_frequency VARCHAR(20), -- 'very_high', 'high', 'medium', 'low', 'very_low'
  tef_min DECIMAL(8,4), -- Annual occurrences min
  tef_max DECIMAL(8,4), -- Annual occurrences max
  tef_rationale TEXT,
  
  -- FAIR: Vulnerability (probability threat succeeds)
  vulnerability VARCHAR(20),
  vuln_min DECIMAL(5,4), -- 0.0 - 1.0
  vuln_max DECIMAL(5,4),
  vuln_rationale TEXT,
  
  -- FAIR: Loss Magnitude components
  productivity_loss_min DECIMAL(12,2),
  productivity_loss_max DECIMAL(12,2),
  response_cost_min DECIMAL(12,2),
  response_cost_max DECIMAL(12,2),
  replacement_cost_min DECIMAL(12,2),
  replacement_cost_max DECIMAL(12,2),
  competitive_advantage_loss_min DECIMAL(12,2),
  competitive_advantage_loss_max DECIMAL(12,2),
  regulatory_fine_min DECIMAL(12,2),
  regulatory_fine_max DECIMAL(12,2),
  reputation_damage_min DECIMAL(12,2),
  reputation_damage_max DECIMAL(12,2),
  
  -- Calculated: Loss Event Frequency (LEF) = TEF * Vulnerability
  lef_min DECIMAL(8,4),
  lef_max DECIMAL(8,4),
  
  -- Calculated: Single Loss Expectancy (sum of loss magnitudes)
  sle_min DECIMAL(15,2),
  sle_max DECIMAL(15,2),
  
  -- Calculated: Annualized Loss Expectancy (LEF * SLE)
  ale_min DECIMAL(15,2),
  ale_max DECIMAL(15,2),
  
  calculated_at TIMESTAMP DEFAULT NOW(),
  calculated_by INTEGER REFERENCES users(id),
  
  UNIQUE(finding_id)
);

-- Engagement-level risk summary
CREATE TABLE engagement_risk_summary (
  id SERIAL PRIMARY KEY,
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  
  total_findings INTEGER,
  critical_findings INTEGER,
  high_findings INTEGER,
  
  -- Aggregated ALE
  total_ale_min DECIMAL(15,2),
  total_ale_max DECIMAL(15,2),
  
  -- Post-remediation estimates
  residual_ale_min DECIMAL(15,2),
  residual_ale_max DECIMAL(15,2),
  
  -- Risk reduction value
  risk_reduction_min DECIMAL(15,2),
  risk_reduction_max DECIMAL(15,2),
  
  -- Top risk drivers (finding IDs)
  top_risk_drivers JSONB, -- [{finding_id, ale_max, title}, ...]
  
  calculated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(engagement_id)
);
```

### AI-Generated Content

```sql
CREATE TABLE ai_generated_content (
  id SERIAL PRIMARY KEY,
  
  -- Context
  engagement_id INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
  finding_id INTEGER REFERENCES findings(id) ON DELETE SET NULL,
  
  content_type VARCHAR(30) NOT NULL,
  -- Values: 'executive_summary', 'finding_description', 'remediation_steps',
  --         'business_impact', 'technical_details', 'risk_narrative'
  
  -- Generation
  prompt_template VARCHAR(50),
  input_context JSONB, -- Data used for generation
  generated_content TEXT NOT NULL,
  
  -- Review workflow
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'approved', 'rejected', 'edited'
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  edited_content TEXT, -- User modifications (NULL if unedited)
  rejection_reason TEXT,
  
  -- Metadata
  model_used VARCHAR(50), -- 'claude-3-sonnet', 'gpt-4'
  tokens_used INTEGER,
  generation_time_ms INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Benchmarking (Optional Community Feature)

```sql
-- Opt-in benchmark contribution
CREATE TABLE benchmark_opt_in (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  
  opted_in BOOLEAN DEFAULT false,
  industry VARCHAR(50),
  employee_range VARCHAR(20), -- '100-500', '500-1000', '1000-5000', '5000+'
  region VARCHAR(50),
  
  opted_in_at TIMESTAMP,
  
  UNIQUE(organization_id)
);

-- Anonymized benchmark data
CREATE TABLE benchmark_data (
  id SERIAL PRIMARY KEY,
  
  -- Anonymized org context
  industry VARCHAR(50),
  employee_range VARCHAR(20),
  region VARCHAR(50),
  
  -- Technique results (no org identifier)
  technique_id VARCHAR(20),
  outcome VARCHAR(30),
  time_to_detect_seconds INTEGER,
  
  contributed_at TIMESTAMP DEFAULT NOW()
);

-- Aggregated industry benchmarks
CREATE TABLE industry_benchmarks (
  id SERIAL PRIMARY KEY,
  
  industry VARCHAR(50) NOT NULL,
  technique_id VARCHAR(20) NOT NULL,
  
  sample_size INTEGER,
  detection_rate DECIMAL(5,2),
  prevention_rate DECIMAL(5,2),
  avg_ttd_seconds INTEGER,
  median_ttd_seconds INTEGER,
  
  percentile_25 DECIMAL(5,2),
  percentile_50 DECIMAL(5,2),
  percentile_75 DECIMAL(5,2),
  
  last_updated TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(industry, technique_id)
);
```

---

## API Endpoints

### Security Tools
```
GET    /api/organizations/:orgId/security-tools
POST   /api/organizations/:orgId/security-tools
PUT    /api/security-tools/:id
DELETE /api/security-tools/:id
```

### Tool Outcomes
```
GET    /api/engagements/:id/techniques/:techId/tool-outcomes
POST   /api/engagements/:id/techniques/:techId/tool-outcomes
PUT    /api/tool-outcomes/:id
DELETE /api/tool-outcomes/:id
GET    /api/engagements/:id/tool-outcomes/matrix  -- Full matrix view
```

### Engagement Metrics
```
GET    /api/engagements/:id/metrics
POST   /api/engagements/:id/metrics/calculate  -- Trigger recalculation
GET    /api/engagements/:id/metrics/by-tactic
GET    /api/engagements/:id/metrics/by-tool
```

### Historical Trending
```
GET    /api/organizations/:orgId/trends
       ?start_date=2024-01-01&end_date=2025-01-01
       &metric=threat_resilience_score
GET    /api/organizations/:orgId/trends/compare
       ?engagement_ids=1,2,3
```

### ATT&CK Coverage
```
GET    /api/organizations/:orgId/attack-coverage
       ?threat_actor=APT29
       &tactics=initial_access,execution
GET    /api/organizations/:orgId/attack-coverage/heatmap
GET    /api/organizations/:orgId/attack-coverage/gaps
POST   /api/organizations/:orgId/attack-coverage/export-navigator
```

### Detection Rules
```
GET    /api/techniques/:techId/detection-rules
       ?rule_type=sigma
GET    /api/findings/:id/recommended-rules
POST   /api/findings/:id/detection-rules/:ruleId/implement
POST   /api/detection-rules/convert
       Body: { rule_id, target_format: 'splunk_spl' }
```

### Risk Quantification
```
GET    /api/organizations/:orgId/risk-parameters
PUT    /api/organizations/:orgId/risk-parameters
POST   /api/findings/:id/risk-quantification
GET    /api/findings/:id/risk-quantification
GET    /api/engagements/:id/risk-summary
POST   /api/engagements/:id/risk-summary/calculate
```

### AI Content Generation
```
POST   /api/engagements/:id/ai/generate-executive-summary
POST   /api/findings/:id/ai/generate-description
POST   /api/findings/:id/ai/generate-remediation
POST   /api/findings/:id/ai/generate-business-impact
GET    /api/ai-content/:id
PUT    /api/ai-content/:id/approve
PUT    /api/ai-content/:id/reject
PUT    /api/ai-content/:id/edit
```

### Benchmarking
```
GET    /api/organizations/:orgId/benchmark-opt-in
PUT    /api/organizations/:orgId/benchmark-opt-in
GET    /api/benchmarks/industry/:industry
GET    /api/benchmarks/compare
       ?technique_id=T1003.001&industry=healthcare
```

---

## Services

### MetricsCalculator

```javascript
// services/metricsCalculator.js

class MetricsCalculator {
  
  async calculateEngagementMetrics(engagementId) {
    const techniques = await this.getTechniquesWithOutcomes(engagementId);
    const outcomeWeights = await this.getOutcomeWeights(engagementId);
    
    // Count outcomes
    const counts = {
      total: techniques.length,
      blocked: 0,
      alerted: 0,
      logged: 0,
      missed: 0
    };
    
    let weightedScoreSum = 0;
    const timings = [];
    
    for (const tech of techniques) {
      const bestOutcome = this.getBestOutcome(tech.toolOutcomes);
      
      if (bestOutcome === 'blocked') counts.blocked++;
      else if (bestOutcome.startsWith('alerted')) counts.alerted++;
      else if (bestOutcome.startsWith('logged')) counts.logged++;
      else counts.missed++;
      
      weightedScoreSum += outcomeWeights[bestOutcome] || 0;
      
      if (tech.timeToDetect) timings.push(tech.timeToDetect);
    }
    
    return {
      total_techniques: counts.total,
      techniques_blocked: counts.blocked,
      techniques_alerted: counts.alerted,
      techniques_logged_only: counts.logged,
      techniques_not_detected: counts.missed,
      
      threat_resilience_score: (weightedScoreSum / counts.total) * 100,
      prevention_rate: (counts.blocked / counts.total) * 100,
      detection_rate: ((counts.blocked + counts.alerted) / counts.total) * 100,
      visibility_rate: ((counts.blocked + counts.alerted + counts.logged) / counts.total) * 100,
      
      avg_time_to_detect: this.average(timings),
      median_time_to_detect: this.median(timings),
      min_time_to_detect: Math.min(...timings),
      max_time_to_detect: Math.max(...timings)
    };
  }
  
  getBestOutcome(toolOutcomes) {
    const priority = ['blocked', 'alerted_high', 'alerted_medium', 'alerted_low', 
                      'logged_central', 'logged_local', 'not_detected'];
    
    for (const outcome of priority) {
      if (toolOutcomes.some(o => o.outcome === outcome)) {
        return outcome;
      }
    }
    return 'not_detected';
  }
  
  async calculateToolEfficacy(engagementId, toolId) {
    // Calculate per-tool detection stats
  }
  
  async calculateTacticBreakdown(engagementId) {
    // Group by MITRE tactic, calculate per-tactic scores
  }
}
```

### RiskQuantifier

```javascript
// services/riskQuantifier.js

class RiskQuantifier {
  
  // FAIR frequency mappings (annual occurrences)
  static TEF_RANGES = {
    very_high: { min: 100, max: 1000 },
    high: { min: 10, max: 100 },
    medium: { min: 1, max: 10 },
    low: { min: 0.1, max: 1 },
    very_low: { min: 0.01, max: 0.1 }
  };
  
  static VULN_RANGES = {
    very_high: { min: 0.8, max: 1.0 },
    high: { min: 0.6, max: 0.8 },
    medium: { min: 0.4, max: 0.6 },
    low: { min: 0.2, max: 0.4 },
    very_low: { min: 0.0, max: 0.2 }
  };
  
  async quantifyFinding(findingId, params) {
    const finding = await this.getFinding(findingId);
    const orgParams = await this.getOrgRiskParams(finding.organization_id);
    
    // Get TEF range
    const tefRange = RiskQuantifier.TEF_RANGES[params.threat_event_frequency];
    
    // Get vulnerability range (based on detection outcome)
    const vulnRange = this.calculateVulnerability(finding);
    
    // Calculate Loss Event Frequency
    const lef_min = tefRange.min * vulnRange.min;
    const lef_max = tefRange.max * vulnRange.max;
    
    // Sum loss magnitudes for Single Loss Expectancy
    const sle_min = (params.productivity_loss_min || 0) +
                    (params.response_cost_min || 0) +
                    (params.replacement_cost_min || 0) +
                    (params.regulatory_fine_min || 0) +
                    (params.reputation_damage_min || 0);
    
    const sle_max = (params.productivity_loss_max || 0) +
                    (params.response_cost_max || 0) +
                    (params.replacement_cost_max || 0) +
                    (params.regulatory_fine_max || 0) +
                    (params.reputation_damage_max || 0);
    
    // Annualized Loss Expectancy
    const ale_min = lef_min * sle_min;
    const ale_max = lef_max * sle_max;
    
    return {
      lef_min, lef_max,
      sle_min, sle_max,
      ale_min, ale_max
    };
  }
  
  calculateVulnerability(finding) {
    // Map detection outcome to vulnerability
    // Not detected = high vulnerability
    // Blocked = low vulnerability
    const outcome = finding.detection_outcome;
    
    if (outcome === 'blocked') return { min: 0.05, max: 0.15 };
    if (outcome.startsWith('alerted')) return { min: 0.2, max: 0.4 };
    if (outcome.startsWith('logged')) return { min: 0.5, max: 0.7 };
    return { min: 0.8, max: 0.95 }; // Not detected
  }
  
  async calculateEngagementRisk(engagementId) {
    const findings = await this.getFindingsWithRisk(engagementId);
    
    let total_ale_min = 0;
    let total_ale_max = 0;
    
    const topRisks = [];
    
    for (const finding of findings) {
      if (finding.risk) {
        total_ale_min += finding.risk.ale_min;
        total_ale_max += finding.risk.ale_max;
        
        topRisks.push({
          finding_id: finding.id,
          title: finding.title,
          ale_max: finding.risk.ale_max
        });
      }
    }
    
    // Sort by risk
    topRisks.sort((a, b) => b.ale_max - a.ale_max);
    
    return {
      total_ale_min,
      total_ale_max,
      top_risk_drivers: topRisks.slice(0, 5)
    };
  }
}
```

### DetectionRuleGenerator

```javascript
// services/detectionRuleGenerator.js

class DetectionRuleGenerator {
  
  async getRecommendedRules(techniqueId) {
    // Fetch from detection_rules table
    // Could also integrate with Sigma rule repository API
  }
  
  async convertRule(ruleId, targetFormat) {
    const rule = await this.getRule(ruleId);
    
    if (rule.rule_type === 'sigma') {
      return this.convertSigmaTo(rule.rule_content, targetFormat);
    }
    
    throw new Error(`Cannot convert from ${rule.rule_type}`);
  }
  
  convertSigmaTo(sigmaYaml, targetFormat) {
    // Use sigma-cli or custom conversion logic
    switch (targetFormat) {
      case 'splunk_spl':
        return this.sigmaToSplunk(sigmaYaml);
      case 'elastic_kql':
        return this.sigmaToElastic(sigmaYaml);
      case 'sentinel_kql':
        return this.sigmaToSentinel(sigmaYaml);
      default:
        throw new Error(`Unsupported format: ${targetFormat}`);
    }
  }
  
  // Basic Sigma to Splunk conversion
  sigmaToSplunk(sigmaYaml) {
    // Parse YAML, build SPL query
    // This is simplified - real implementation would use sigma-cli
    const sigma = yaml.parse(sigmaYaml);
    
    let spl = 'index=* ';
    
    if (sigma.logsource?.service === 'sysmon') {
      spl = 'index=sysmon ';
    }
    
    // Build conditions from detection
    const conditions = [];
    for (const [key, value] of Object.entries(sigma.detection?.selection || {})) {
      if (Array.isArray(value)) {
        conditions.push(`(${key}="${value.join('" OR ' + key + '="')}")`);
      } else {
        conditions.push(`${key}="${value}"`);
      }
    }
    
    spl += conditions.join(' AND ');
    
    return spl;
  }
}
```

### AIContentGenerator

```javascript
// services/aiContentGenerator.js

class AIContentGenerator {
  
  constructor(aiClient) {
    this.ai = aiClient; // Anthropic/OpenAI client
  }
  
  async generateExecutiveSummary(engagementId) {
    const engagement = await this.getEngagementWithMetrics(engagementId);
    const findings = await this.getTopFindings(engagementId, 5);
    const riskSummary = await this.getRiskSummary(engagementId);
    const previousMetrics = await this.getPreviousMetrics(engagement.organization_id);
    
    const prompt = `Generate a professional executive summary for a purple team exercise.

ENGAGEMENT DATA:
- Name: ${engagement.name}
- Dates: ${engagement.start_date} to ${engagement.end_date}
- Techniques tested: ${engagement.metrics.total_techniques}
- Threat Resilience Score: ${engagement.metrics.threat_resilience_score}%
- Previous Score: ${previousMetrics?.threat_resilience_score || 'N/A'}%
- Detection Rate: ${engagement.metrics.detection_rate}%
- Average Time to Detect: ${engagement.metrics.avg_time_to_detect} seconds

TOP FINDINGS:
${findings.map(f => `- [${f.severity}] ${f.title}`).join('\n')}

RISK SUMMARY:
- Total Annual Loss Expectancy: $${riskSummary.total_ale_min.toLocaleString()} - $${riskSummary.total_ale_max.toLocaleString()}
- Top Risk: ${riskSummary.top_risk_drivers[0]?.title || 'N/A'}

Write a 3-4 paragraph executive summary that:
1. States the exercise purpose and scope
2. Highlights key achievements and improvements
3. Summarizes critical gaps and their business impact
4. Lists top 3 priority recommendations

Use professional, board-appropriate language. Include specific numbers.`;

    const response = await this.ai.complete(prompt);
    
    return {
      content_type: 'executive_summary',
      engagement_id: engagementId,
      input_context: { engagement, findings, riskSummary },
      generated_content: response.text
    };
  }
  
  async generateFindingDescription(findingId) {
    // Generate technical finding description
  }
  
  async generateRemediation(findingId) {
    // Generate step-by-step remediation
  }
  
  async generateBusinessImpact(findingId) {
    // Translate technical finding to business risk
  }
}
```

---

## Frontend Components

### ToolOutcomeMatrix.jsx
```
Per-technique grid showing outcome per security tool.
Columns: technique | tool1 | tool2 | tool3 | overall
Cells: color-coded outcome (🟢 blocked, 🟡 alert, 🔵 log, ⚪ miss)
```

### ThreatResilienceDashboard.jsx
```
Main metrics dashboard:
- Large score gauge (0-100%)
- Outcome breakdown bar (blocked/alerted/logged/missed)
- Trend sparkline
- Comparison to last exercise
```

### TrendChart.jsx
```
Line chart showing metrics over time.
Supports: threat_resilience, detection_rate, prevention_rate, avg_ttd
Filter by date range, engagement comparison mode.
```

### AttackCoverageHeatmap.jsx
```
ATT&CK matrix visualization.
Color by: tested/pass, tested/fail, untested
Filter by: threat actor, tactic, date range
Export: ATT&CK Navigator JSON
```

### DetectionRulePanel.jsx
```
Shows recommended rules for a finding/technique.
Tabs: Sigma | Splunk | Elastic | Sentinel
Copy button, implementation status tracking.
```

### RiskQuantificationForm.jsx
```
FAIR-based input form for finding risk.
Inputs: TEF, vulnerability, loss magnitudes
Auto-calculates: LEF, SLE, ALE
Displays: risk range with visual scale
```

### RiskSummaryWidget.jsx
```
Engagement-level risk dashboard.
Total ALE range, top risk drivers, risk reduction estimate.
Suitable for executive reports.
```

### AIContentPanel.jsx
```
Generate/review AI content.
Buttons: Generate Executive Summary, Generate Descriptions
Review workflow: Draft → Approve/Edit/Reject
Side-by-side original vs AI content.
```

---

## Security Requirements

### Input Validation
- Validate all enum values (outcome, severity, frequency)
- Sanitize text before AI prompts to prevent injection
- Validate numeric ranges for risk parameters

### Authorization
- Tool outcomes: engagement member only
- Risk parameters: organization admin only
- AI generation: engagement member only
- Benchmarks: org admin for opt-in, read-only for data

### Data Privacy (Benchmarking)
- Strip all PII before contributing to benchmarks
- No organization identifiers in benchmark_data
- Aggregate to minimum sample size (e.g., n≥10) before displaying

### Rate Limiting
- AI generation: 10 requests/engagement/hour
- Metrics calculation: 5 requests/engagement/hour
- Benchmark queries: 100/org/day

---

## Implementation Order

1. **Week 1-2:** Security tools, tool outcomes, basic metrics
2. **Week 2-3:** Engagement metrics calculation, per-tool efficacy
3. **Week 3-4:** Historical trending, metric snapshots
4. **Week 4-5:** ATT&CK coverage heatmap with threat actor filtering
5. **Week 5-6:** Detection rules database, rule recommendations
6. **Week 6-7:** Risk quantification (FAIR model)
7. **Week 7-8:** AI content generation integration
8. **Week 9-10:** Benchmarking (optional), dashboards polish

---

## Testing

### Unit Tests
- MetricsCalculator: outcome aggregation, score calculation
- RiskQuantifier: FAIR calculations, ALE computation
- DetectionRuleGenerator: Sigma conversion accuracy

### Integration Tests
- Full metrics calculation flow
- AI generation with mocked AI client
- Benchmark contribution and aggregation

### Security Tests
- Benchmark data anonymization verification
- AI prompt injection attempts
- Cross-org data access prevention
