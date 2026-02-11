module.exports = [
  `ALTER TABLE engagements ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);`,
  `
    CREATE TABLE IF NOT EXISTS security_tools (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      category VARCHAR(30) NOT NULL,
      vendor VARCHAR(100),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_tool_category CHECK (category IN (
        'edr', 'siem', 'email_gateway', 'firewall', 'ndr', 'waf', 'casb', 'iam', 'av', 'dlp', 'proxy', 'other'
      )),
      CONSTRAINT unique_org_tool_name UNIQUE (organization_id, name)
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_security_tools_org ON security_tools(organization_id);`,
  `
    CREATE TABLE IF NOT EXISTS technique_tool_outcomes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique_id UUID REFERENCES techniques(id) ON DELETE CASCADE,
      security_tool_id UUID REFERENCES security_tools(id) ON DELETE CASCADE,

      outcome VARCHAR(30) NOT NULL,
      alert_name VARCHAR(255),
      alert_id VARCHAR(100),
      alert_severity VARCHAR(20),
      response_time_seconds INTEGER,
      detection_logic TEXT,
      notes TEXT,

      recorded_by UUID REFERENCES users(id),
      recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_tool_outcome CHECK (outcome IN (
        'blocked', 'alerted_high', 'alerted_medium', 'alerted_low',
        'logged_central', 'logged_local', 'not_detected', 'not_applicable'
      )),
      CONSTRAINT unique_technique_tool UNIQUE (technique_id, security_tool_id)
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_technique_tool_outcomes_technique ON technique_tool_outcomes(technique_id);`,
  `CREATE INDEX IF NOT EXISTS idx_technique_tool_outcomes_tool ON technique_tool_outcomes(security_tool_id);`,
  `
    CREATE TABLE IF NOT EXISTS outcome_weights (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      outcome VARCHAR(30) NOT NULL,
      weight DECIMAL(3,2) NOT NULL,

      CONSTRAINT unique_org_outcome UNIQUE (organization_id, outcome)
    );
  `,
  `
    INSERT INTO outcome_weights (organization_id, outcome, weight) VALUES
      (NULL, 'blocked', 1.0),
      (NULL, 'alerted_high', 0.9),
      (NULL, 'alerted_medium', 0.75),
      (NULL, 'alerted_low', 0.6),
      (NULL, 'logged_central', 0.4),
      (NULL, 'logged_local', 0.2),
      (NULL, 'not_detected', 0.0)
    ON CONFLICT DO NOTHING;
  `,
  `
    CREATE TABLE IF NOT EXISTS engagement_metrics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,

      -- Counts
      total_techniques INTEGER NOT NULL,
      techniques_blocked INTEGER DEFAULT 0,
      techniques_alerted INTEGER DEFAULT 0,
      techniques_logged_only INTEGER DEFAULT 0,
      techniques_not_detected INTEGER DEFAULT 0,

      -- Scores (0-100)
      threat_resilience_score DECIMAL(5,2),
      prevention_rate DECIMAL(5,2),
      detection_rate DECIMAL(5,2),
      visibility_rate DECIMAL(5,2),

      -- Timing (seconds)
      avg_time_to_detect INTEGER,
      median_time_to_detect INTEGER,
      min_time_to_detect INTEGER,
      max_time_to_detect INTEGER,
      avg_time_to_investigate INTEGER,

      -- Per-tactic breakdown (JSONB)
      tactic_scores JSONB,

      -- Per-tool breakdown (JSONB)
      tool_scores JSONB,

      calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT unique_engagement_metrics UNIQUE (engagement_id)
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_engagement_metrics_engagement ON engagement_metrics(engagement_id);`,
  `
    CREATE TABLE IF NOT EXISTS engagement_tool_efficacy (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      security_tool_id UUID REFERENCES security_tools(id) ON DELETE CASCADE,

      techniques_applicable INTEGER,
      techniques_blocked INTEGER,
      techniques_alerted INTEGER,
      techniques_logged INTEGER,
      techniques_missed INTEGER,

      efficacy_score DECIMAL(5,2),
      avg_response_time_seconds INTEGER,

      CONSTRAINT unique_engagement_tool_efficacy UNIQUE (engagement_id, security_tool_id)
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_engagement_tool_efficacy_engagement ON engagement_tool_efficacy(engagement_id);`,
  `CREATE INDEX IF NOT EXISTS idx_engagement_tool_efficacy_tool ON engagement_tool_efficacy(security_tool_id);`,
  `
    CREATE TABLE IF NOT EXISTS metric_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      engagement_id UUID REFERENCES engagements(id),
      snapshot_date DATE NOT NULL,

      -- Core metrics
      threat_resilience_score DECIMAL(5,2),
      prevention_rate DECIMAL(5,2),
      detection_rate DECIMAL(5,2),
      visibility_rate DECIMAL(5,2),
      avg_time_to_detect INTEGER,

      -- Coverage
      techniques_tested INTEGER,
      attack_coverage_percent DECIMAL(5,2),

      -- Breakdowns
      tactic_scores JSONB,
      tool_scores JSONB,

      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_metric_snapshots_org ON metric_snapshots(organization_id);`,
  `CREATE INDEX IF NOT EXISTS idx_metric_snapshots_date ON metric_snapshots(snapshot_date);`,
  `
    CREATE TABLE IF NOT EXISTS attack_coverage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      technique_id VARCHAR(20) NOT NULL,

      -- Latest results
      last_tested_at TIMESTAMP WITH TIME ZONE,
      last_engagement_id UUID REFERENCES engagements(id),
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

      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_coverage_status CHECK (coverage_status IN (
        'tested_pass', 'tested_partial', 'tested_fail', 'untested', 'not_applicable'
      )),
      CONSTRAINT unique_org_technique_coverage UNIQUE (organization_id, technique_id)
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_attack_coverage_org ON attack_coverage(organization_id);`,
  `CREATE INDEX IF NOT EXISTS idx_attack_coverage_technique ON attack_coverage(technique_id);`,
  `CREATE INDEX IF NOT EXISTS idx_attack_coverage_status ON attack_coverage(coverage_status);`,
  `
    CREATE TABLE IF NOT EXISTS detection_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      technique_id VARCHAR(20) NOT NULL,

      rule_type VARCHAR(30) NOT NULL,
      rule_name VARCHAR(255) NOT NULL,
      rule_content TEXT NOT NULL,

      -- Metadata
      data_sources_required TEXT[],
      log_sources TEXT[],
      mitre_data_sources TEXT[],

      confidence VARCHAR(20) DEFAULT 'medium',
      severity VARCHAR(20) DEFAULT 'medium',
      false_positive_likelihood VARCHAR(20),
      false_positive_notes TEXT,

      -- Source
      source VARCHAR(50),
      source_url TEXT,

      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_rule_type CHECK (rule_type IN (
        'sigma', 'splunk_spl', 'elastic_kql', 'sentinel_kql', 'chronicle_yara_l', 'yara'
      )),
      CONSTRAINT valid_rule_confidence CHECK (confidence IN ('high', 'medium', 'low')),
      CONSTRAINT valid_rule_severity CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info'))
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_detection_rules_technique ON detection_rules(technique_id);`,
  `CREATE INDEX IF NOT EXISTS idx_detection_rules_type ON detection_rules(rule_type);`,
  `
    CREATE TABLE IF NOT EXISTS finding_detection_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action_item_id UUID REFERENCES action_items(id) ON DELETE CASCADE,
      detection_rule_id UUID REFERENCES detection_rules(id) ON DELETE CASCADE,

      -- Implementation tracking
      implementation_status VARCHAR(20) DEFAULT 'recommended',

      implemented_by UUID REFERENCES users(id),
      implemented_at TIMESTAMP WITH TIME ZONE,
      rejection_reason TEXT,

      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_impl_status CHECK (implementation_status IN (
        'recommended', 'in_progress', 'implemented', 'rejected'
      )),
      CONSTRAINT unique_finding_rule UNIQUE (action_item_id, detection_rule_id)
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_finding_detection_rules_action ON finding_detection_rules(action_item_id);`,
  `CREATE INDEX IF NOT EXISTS idx_finding_detection_rules_rule ON finding_detection_rules(detection_rule_id);`,
  `
    CREATE TABLE IF NOT EXISTS risk_parameters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

      -- Asset values
      avg_employee_hourly_cost DECIMAL(10,2) DEFAULT 75.00,
      avg_downtime_cost_per_hour DECIMAL(12,2),
      data_record_value DECIMAL(10,2) DEFAULT 150.00,

      -- Industry context
      industry VARCHAR(50),
      annual_revenue DECIMAL(15,2),
      employee_count INTEGER,

      -- Regulatory context
      regulatory_frameworks TEXT[],
      max_regulatory_fine DECIMAL(15,2),

      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT unique_org_risk_params UNIQUE (organization_id)
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS finding_risk_quantification (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action_item_id UUID REFERENCES action_items(id) ON DELETE CASCADE,

      -- FAIR: Threat Event Frequency (TEF)
      threat_event_frequency VARCHAR(20),
      tef_min DECIMAL(8,4),
      tef_max DECIMAL(8,4),
      tef_rationale TEXT,

      -- FAIR: Vulnerability
      vulnerability VARCHAR(20),
      vuln_min DECIMAL(5,4),
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

      -- Calculated: Loss Event Frequency
      lef_min DECIMAL(8,4),
      lef_max DECIMAL(8,4),

      -- Calculated: Single Loss Expectancy
      sle_min DECIMAL(15,2),
      sle_max DECIMAL(15,2),

      -- Calculated: Annualized Loss Expectancy
      ale_min DECIMAL(15,2),
      ale_max DECIMAL(15,2),

      calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      calculated_by UUID REFERENCES users(id),

      CONSTRAINT valid_tef CHECK (threat_event_frequency IN (
        'very_high', 'high', 'medium', 'low', 'very_low'
      )),
      CONSTRAINT valid_vuln CHECK (vulnerability IN (
        'very_high', 'high', 'medium', 'low', 'very_low'
      )),
      CONSTRAINT unique_finding_risk UNIQUE (action_item_id)
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_finding_risk_action ON finding_risk_quantification(action_item_id);`,
  `
    CREATE TABLE IF NOT EXISTS engagement_risk_summary (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,

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

      -- Top risk drivers
      top_risk_drivers JSONB,

      calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT unique_engagement_risk UNIQUE (engagement_id)
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_engagement_risk_engagement ON engagement_risk_summary(engagement_id);`,
  `
    CREATE TABLE IF NOT EXISTS ai_generated_content (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      -- Context
      engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
      action_item_id UUID REFERENCES action_items(id) ON DELETE SET NULL,

      content_type VARCHAR(30) NOT NULL,

      -- Generation
      prompt_template VARCHAR(50),
      input_context JSONB,
      generated_content TEXT NOT NULL,

      -- Review workflow
      status VARCHAR(20) DEFAULT 'draft',
      reviewed_by UUID REFERENCES users(id),
      reviewed_at TIMESTAMP WITH TIME ZONE,
      edited_content TEXT,
      rejection_reason TEXT,

      -- Metadata
      model_used VARCHAR(50),
      tokens_used INTEGER,
      generation_time_ms INTEGER,

      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT valid_ai_content_type CHECK (content_type IN (
        'executive_summary', 'finding_description', 'remediation_steps',
        'business_impact', 'technical_details', 'risk_narrative'
      )),
      CONSTRAINT valid_ai_status CHECK (status IN ('draft', 'approved', 'rejected', 'edited'))
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_ai_content_engagement ON ai_generated_content(engagement_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ai_content_action_item ON ai_generated_content(action_item_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ai_content_status ON ai_generated_content(status);`,
  `
    CREATE TABLE IF NOT EXISTS benchmark_opt_in (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

      opted_in BOOLEAN DEFAULT false,
      industry VARCHAR(50),
      employee_range VARCHAR(20),
      region VARCHAR(50),

      opted_in_at TIMESTAMP WITH TIME ZONE,

      CONSTRAINT valid_employee_range CHECK (employee_range IN (
        '1-100', '100-500', '500-1000', '1000-5000', '5000+'
      )),
      CONSTRAINT unique_org_benchmark UNIQUE (organization_id)
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS benchmark_data (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      -- Anonymized org context
      industry VARCHAR(50),
      employee_range VARCHAR(20),
      region VARCHAR(50),

      -- Technique results (no org identifier)
      technique_id VARCHAR(20),
      outcome VARCHAR(30),
      time_to_detect_seconds INTEGER,

      contributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_benchmark_data_industry ON benchmark_data(industry);`,
  `CREATE INDEX IF NOT EXISTS idx_benchmark_data_technique ON benchmark_data(technique_id);`,
  `
    CREATE TABLE IF NOT EXISTS industry_benchmarks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

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

      last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT unique_industry_technique UNIQUE (industry, technique_id)
    );
  `,
  `CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_industry ON industry_benchmarks(industry);`,
  `CREATE INDEX IF NOT EXISTS idx_industry_benchmarks_technique ON industry_benchmarks(technique_id);`
];
