import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

// "Are you logged in AND the right role" check. Must run after JwtAuthGuard
// so req.user is already populated. Apply with
// @UseGuards(JwtAuthGuard, RolesGuard) @Roles('OWNER', 'MANAGER')
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true; // no role restriction

    const { user } = context.switchToHttp().getRequest();
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Requires one of: ${requiredRoles.join(', ')}`);
    }
    return true;
  }
}
