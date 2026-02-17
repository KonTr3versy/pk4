import assert from 'node:assert/strict';
import { resolveInitialRoute } from './routeGuard.js';

assert.equal(resolveInitialRoute({ setupRequired: true, authenticated: false }), '/onboarding');
assert.equal(resolveInitialRoute({ setupRequired: false, authenticated: false }), '/onboarding');
assert.equal(resolveInitialRoute({ setupRequired: false, authenticated: true }), '/');

console.log('routeGuard tests passed');
