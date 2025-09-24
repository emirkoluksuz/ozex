import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../common/public.decorator';  // 👈 path düzeltildi
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

type JwtPayload = {
  sub: string;        // userId
  email?: string;
  roles?: string[];
  username?: string;
  iat?: number;
  exp?: number;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly cfg: ConfigService
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // 1) @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();

    // 2) Preflight
    if (req.method === 'OPTIONS') return true;

    // 3) Muaf rotalar
    const path = req?.path || req?.url || '';
    if (path === '/metrics') return true;
    if (process.env.NODE_ENV !== 'production' && path.startsWith('/docs')) return true;

    // 4) Sadece Authorization: Bearer <token>
    const header = (req.headers['authorization'] as string | undefined) ?? '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new UnauthorizedException('Missing access token');
    }
    const token = match[1];

    // 5) Doğrula
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.cfg.get<string>('JWT_ACCESS_SECRET')!,
      });

      (req as any).user = {
        userId: payload.sub,
        email: payload.email,
        roles: payload.roles ?? [],
        username: payload.username,
        iat: payload.iat,
        exp: payload.exp,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
