module.exports = [
  `UPDATE engagement_goals SET goal_type = 'train_team' WHERE goal_type = 'collaborative_culture';`,
  `UPDATE engagement_goals SET goal_type = 'threat_emulation' WHERE goal_type IN ('test_attack_chains', 'test_new_ttps', 'red_team_replay');`,
  `UPDATE engagement_goals SET goal_type = 'test_response' WHERE goal_type IN ('train_defenders', 'test_processes');`,
  `ALTER TABLE engagement_goals DROP CONSTRAINT IF EXISTS valid_goal_type;`,
  `
    ALTER TABLE engagement_goals
    ADD CONSTRAINT valid_goal_type CHECK (goal_type IN (
      'validate_detection', 'test_response', 'measure_coverage', 'train_team',
      'compliance_evidence', 'tool_evaluation', 'threat_emulation', 'custom'
    ));
  `
];
