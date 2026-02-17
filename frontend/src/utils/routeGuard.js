export function resolveInitialRoute({ setupRequired, authenticated }) {
  if (setupRequired) {
    return '/onboarding';
  }

  if (!authenticated) {
    return '/login';
  }

  return '/';
}
