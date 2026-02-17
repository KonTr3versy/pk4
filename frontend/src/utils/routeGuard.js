export function resolveInitialRoute({ setupRequired, authenticated }) {
  if (setupRequired || !authenticated) {
    return '/onboarding';
  }
  return '/';
}
