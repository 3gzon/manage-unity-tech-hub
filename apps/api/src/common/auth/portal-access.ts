export function isPortalAdmin(roles: readonly string[]) {
  return roles.includes('SUPER_ADMIN') || roles.includes('BRANCH_ADMIN');
}
