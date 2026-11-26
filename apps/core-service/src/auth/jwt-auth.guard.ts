import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// "Are you logged in at all" check. Apply with @UseGuards(JwtAuthGuard).
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
