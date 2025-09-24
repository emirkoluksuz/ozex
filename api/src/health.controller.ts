// src/health.controller.ts
import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { Public } from "./common/public.decorator";
import { PrismaService } from "./prisma/prisma.service";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { getAppVersion, getGitSha } from "./common/version.util";

@Public()
@ApiTags("System")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Liveness" })
  @ApiOkResponse({ description: "Servis ayakta." })
  ping() {
    return { ok: true, ts: new Date().toISOString() };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness (DB ping)" })
  @ApiOkResponse({ description: "DB bağlantısı hazır olduğunda 200 döner." })
  async ready() {
    // 1.5s timeout ile basit SELECT 1
    const ping = this.prisma.$queryRaw`SELECT 1`;
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error("DB ping timeout")), 1500),
    );

    try {
      await Promise.race([ping, timeout]);
      return { ok: true, db: "up", ts: new Date().toISOString() };
    } catch (e) {
      throw new HttpException(
        {
          ok: false,
          db: "down",
          error: (e as Error).message,
          ts: new Date().toISOString(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get("version")
  @ApiOperation({ summary: "Uygulama sürümü" })
  @ApiOkResponse({ description: "Versiyon bilgisi." })
  version() {
    return {
      version: getAppVersion(),
      gitSha: getGitSha(),
      node: process.version,
      env: process.env.NODE_ENV ?? "development",
      ts: new Date().toISOString(),
    };
  }
}
