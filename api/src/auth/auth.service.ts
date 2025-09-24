import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomUUID } from "crypto";
import type { RegisterDto, LoginDto } from "./dto";
import { AuditAction } from "@prisma/client"; // enum

const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? "10m";
const REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? "30d";

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private signTokens(userId: string, opts?: { remember?: boolean }) {
    const accessToken = this.jwt.sign(
      { sub: userId },
      { secret: process.env.JWT_ACCESS_SECRET!, expiresIn: ACCESS_TTL }
    );

    const jti = randomUUID();
    const remember = !!opts?.remember;
    const refreshToken = this.jwt.sign(
      { sub: userId, jti, rm: remember },
      { secret: process.env.JWT_REFRESH_SECRET!, expiresIn: REFRESH_TTL }
    );
    return { accessToken, refreshToken, jti, remember };
  }

  /** Hata yutsa da akışı bozmaz */
  private async audit(userId: string, action: AuditAction, ip?: string, ua?: string) {
    try {
      await this.prisma.auditLog.create({ data: { userId, action, ip, userAgent: ua } });
    } catch {
      // FK vb. hataları yut
    }
  }

  async register(input: RegisterDto) {
    const email = input.email.toLowerCase().trim();
    const username = input.username.toLowerCase().trim();

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }, { phone: input.phone }] },
      select: { id: true },
    });
    if (existing) throw new BadRequestException("E-posta / kullanıcı adı / telefon zaten kayıtlı");

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { firstName: input.firstName, lastName: input.lastName, phone: input.phone, email, username, passwordHash },
        select: { id: true, email: true, username: true, firstName: true, lastName: true, phone: true, createdAt: true },
      });
      await tx.wallet.create({ data: { userId: user.id } });
      return user;
    });

    return created;
  }

  async login(input: LoginDto, ua?: string, ip?: string) {
    const raw = input.identifier.trim();
    const isEmail = /^\S+@\S+\.\S+$/.test(raw);

    const user = await this.prisma.user.findUnique({
      where: isEmail ? { email: raw.toLowerCase() } : { username: raw.toLowerCase() },
    });
    if (!user) throw new UnauthorizedException("Giriş bilgileriniz hatalıdır.");

    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) throw new UnauthorizedException("Giriş bilgileriniz hatalıdır.");

    const { accessToken, refreshToken, jti, remember } = this.signTokens(user.id, {
      remember: input.remember,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.session.create({
        data: { userId: user.id, refreshJti: jti, userAgent: ua, ip, remember },
      });
      await tx.auditLog.create({
        data: { userId: user.id, action: AuditAction.LOGIN, ip, userAgent: ua },
      });
    });

    return { accessToken, refreshToken, remember };
  }

  async refresh(rt: string) {
    let payload: { sub: string; jti: string; rm?: boolean };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string; jti: string; rm?: boolean }>(rt, {
        secret: process.env.JWT_REFRESH_SECRET!,
      });
    } catch {
      throw new UnauthorizedException("Refresh başarısız");
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // 0) Kullanıcı var mı? (session/audit FK'ları için kritik)
      const user = await tx.user.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });
      if (!user) {
        // DB reset edilmiş veya kullanıcı silinmiş → cookie geçersiz say
        throw new UnauthorizedException("Refresh başarısız");
      }

      // 1) Eski jti'yi revoke et
      const { count } = await tx.session.updateMany({
        where: { refreshJti: payload.jti, revokedAt: null },
        data: { revokedAt: now },
      });

      // 2) Reuse tespiti
      if (count === 0) {
        await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now },
        });

        // Audit FK için user garanti var; yine de hata yerse akışı bozmasın diye try-catch
        try {
          await tx.auditLog.create({
            data: { userId: user.id, action: AuditAction.REFRESH_REUSE_BLOCK },
          });
        } catch { /* yut */ }

        throw new UnauthorizedException("Oturum reddedildi");
      }

      // 3) Yeni token’lar
      const { accessToken, refreshToken, jti, remember } = this.signTokens(user.id, {
        remember: !!payload.rm,
      });

      await tx.session.create({
        data: { userId: user.id, refreshJti: jti, remember: !!payload.rm },
      });

      try {
        await tx.auditLog.create({
          data: { userId: user.id, action: AuditAction.REFRESH },
        });
      } catch { /* yut */ }

      return { accessToken, refreshToken, remember };
    });
  }

  async logout(rt?: string, ip?: string, ua?: string) {
    if (!rt) return { ok: true };

    try {
      const { jti, sub } = await this.jwt.verifyAsync<{ sub: string; jti: string }>(rt, {
        secret: process.env.JWT_REFRESH_SECRET!,
      });

      await this.prisma.$transaction(async (tx) => {
        // Oturumu revoke et
        await tx.session.updateMany({
          where: { refreshJti: jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        // Kullanıcı varsa audit yaz (FK güvenliği)
        const user = await tx.user.findUnique({
          where: { id: sub },
          select: { id: true },
        });
        if (user) {
          try {
            await tx.auditLog.create({
              data: { userId: user.id, action: AuditAction.LOGOUT, ip, userAgent: ua },
            });
          } catch { /* yut */ }
        }
      });
    } catch {
      // geçersiz token ise sessizce başarı döndür
    }

    return { ok: true };
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
      },
    });
  }
}
