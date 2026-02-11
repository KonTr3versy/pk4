const VALID_METHODOLOGIES = ['atomic', 'scenario'];
const VALID_VISIBILITY_MODES = ['open', 'blind_blue', 'blind_red'];
const VALID_ENGAGEMENT_STATUSES = ['active', 'completed', 'archived'];
const VALID_TECHNIQUE_STATUSES = ['ready', 'blocked', 'executing', 'validating', 'done'];

function validateAllowedValue(value, allowedValues) {
  return value === undefined || allowedValues.includes(value);
}

module.exports = {
  VALID_METHODOLOGIES,
  VALID_VISIBILITY_MODES,
  VALID_ENGAGEMENT_STATUSES,
  VALID_TECHNIQUE_STATUSES,
  validateAllowedValue
};
