// src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import rateLimit, { Options as RateLimitOptions, ipKeyGenerator } from 'express-rate-limit';
import { json, urlencoded } from 'body-parser';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { IoAdapter } from '@nestjs/platform-socket.io';

/** CORS origin parser: string + regex destekli (ENV: CORS_ORIGINS) */
function parseCorsOrigins(): (string | RegExp)[] {
  const raw = process.env.CORS_ORIGINS;
  const defaults = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  if (!raw) return defaults;
  return Array.from(
    new Set([
      ...defaults,
      ...raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((v) => (v.startsWith('^') ? new RegExp(v) : v)),
    ]),
  );
}

/** https://host -> wss://host dönüşümü */
function httpsToWss(u: string) {
  try {
    const url = new URL(u);
    if (url.protocol === 'https:') {
      url.protocol = 'wss:';
      url.pathname = '';
      return url.origin.replace('https:', 'wss:');
    }
  } catch {}
  return null;
}

/** CSP connect-src (string origin'leri + eşleşen wss://) */
function buildConnectSrc(allowlist: (string | RegExp)[]) {
  const isDev = process.env.NODE_ENV !== 'production';
  const fromCors = allowlist.filter((x): x is string => typeof x === 'string');

  const wssFromCors = fromCors.map(httpsToWss).filter((x): x is string => !!x);

  const fromEnv =
    process.env.CSP_CONNECT_SRC?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];

  const devExtras = isDev ? ['http://localhost:4000', 'ws://localhost:4000'] : [];
  return Array.from(new Set(["'self'", ...fromCors, ...wssFromCors, ...devExtras, ...fromEnv]));
}

/** CORS izin kontrolü */
function corsOriginChecker(allowlist: (string | RegExp)[]) {
  return (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
    // null/undefined Origin (healthcheck, server-to-server, curl) daima serbest
    if (!origin) return cb(null, true);
    const ok = allowlist.some((entry) =>
      typeof entry === 'string' ? entry === origin : entry.test(origin),
    );
    return ok ? cb(null, true) : cb(new Error(`CORS blocked for origin: ${origin}`), false);
  };
}

/** Socket.IO için CORS'u Nest IoAdapter üzerinde aynı whitelist ile uygula */
class CorsIoAdapter extends IoAdapter {
  constructor(private readonly appRef: any, private readonly allowlist: (string | RegExp)[]) {
    super(appRef);
  }
  override createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) =>
          corsOriginChecker(this.allowlist)(origin, cb),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Authorization', 'Content-Type'],
      },
    });
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Proxy arkasında doğru IP (Cloudflare/Caddy)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Body limitleri
  app.use(json({ limit: '512kb' }));
  app.use(urlencoded({ extended: true, limit: '512kb' }));

  // CORS
  const allowlist = parseCorsOrigins();
  app.enableCors({
    origin: corsOriginChecker(allowlist),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-admin-key',
      'X-Admin-Key',
      'x-request-id',
      'if-none-match',
      'X-Idempotency-Key',
      'Idempotency-Key',
      'x-idempotency-key',
    ],
    exposedHeaders: ['ETag', 'X-Request-Id'],
    optionsSuccessStatus: 204,
  });

  // Güvenlik başlıkları (CSP + COEP dev-friendly)
  const connectSrc = buildConnectSrc(allowlist);
  app.use(
    helmet({
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "img-src": ["'self'", "data:"],
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "font-src": ["'self'", "data:"],
          "connect-src": connectSrc,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(cookieParser());

  // Validation & Hata formatı
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: process.env.NODE_ENV === 'production',
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  /* =======================
   * Rate limit bucket'ları
   * ======================= */
  const rlHandler = (req: any, res: any) => {
    res.status(429).json({
      success: false,
      status: 429,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      message: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.',
    });
  };
  const makeLimiter = (opts: Partial<RateLimitOptions>) =>
    rateLimit({ ...opts, standardHeaders: true, legacyHeaders: false, handler: rlHandler });

  const loginLimiter = makeLimiter({
    windowMs: 5 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    keyGenerator: (req: any) => {
      const id = req?.body?.identifier ?? 'noid';
      return `${ipKeyGenerator(req)}:${id}`;
    },
  });
  const registerLimiter = makeLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    keyGenerator: (req: any) => {
      const email = req?.body?.email ?? 'noemail';
      return `${ipKeyGenerator(req)}:${email}`;
    },
  });
  const refreshLimiter = makeLimiter({ windowMs: 60 * 1000, limit: 90 });
  const adminLimiter = makeLimiter({
    windowMs: 60 * 1000,
    limit: 30,
    skipSuccessfulRequests: false,
    keyGenerator: (req: any) => {
      const key = (req.headers['x-admin-key'] as string | undefined) ?? 'nokey';
      return `${ipKeyGenerator(req)}:${key}`;
    },
  });
  const fundingLimiter = makeLimiter({ windowMs: 60 * 1000, limit: 6 });

  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/register', registerLimiter);
  app.use('/api/auth/refresh', refreshLimiter);
  app.use('/api/admin', adminLimiter);
  app.use('/api/wallet/funding', (req: any, res: any, next: any) => {
    if (req.method === 'POST') return (fundingLimiter as any)(req, res, next);
    return next();
  });

  // Socket.IO adapter (CORS whitelist ile)
  app.useWebSocketAdapter(new CorsIoAdapter(app, allowlist));

  // Basit health endpoint (compose healthcheck için)
  app.getHttpAdapter().get('/health', (_req: any, res: any) => res.status(200).send('ok'));

  // Swagger (yalnızca dev)
  const port = Number(process.env.PORT || 4000);
  if (process.env.NODE_ENV !== 'production') {
    const cfg = new DocumentBuilder()
      .setTitle('Trader API')
      .setDescription('Local dev için otomatik API dokümantasyonu')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addCookieAuth('rt', { type: 'apiKey', in: 'cookie', name: 'rt', description: 'Refresh token cookie' })
      .addApiKey({ type: 'apiKey', name: 'X-Admin-Key', in: 'header', description: 'Admin API anahtarı' }, 'admin-key')
      .build();

    const doc = SwaggerModule.createDocument(app, cfg);
    SwaggerModule.setup('docs', app, cleanupOpenApiDoc(doc), {
      jsonDocumentUrl: 'docs/json',
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server on http://localhost:${port}`);
  console.log(`🔓 CORS allowlist:`, allowlist);
  console.log(`🛡️ CSP connect-src:`, connectSrc);
}
bootstrap();
