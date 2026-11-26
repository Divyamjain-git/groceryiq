import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
// Usage: @Roles('OWNER', 'MANAGER') on a controller method.
// If a route has no @Roles() at all, RolesGuard lets any authenticated
// user through — only JwtAuthGuard's "are you logged in" check applies.
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
