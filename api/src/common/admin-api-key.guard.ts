// src/common/admin-api-key.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as crypto from "crypto";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  // farklı uzunluk -> direkt false dön
  if (aBuf.length !== bBuf.length) return false;

  try {
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const key = req.headers["x-admin-key"] as string | undefined;
    const expected = process.env.ADMIN_API_KEY;

    if (!expected) {
      throw new UnauthorizedException("Admin API key not configured");
    }

    if (!key || !safeEqual(key, expected)) {
      throw new UnauthorizedException("Invalid Admin API key");
    }

    return true;
  }
}
