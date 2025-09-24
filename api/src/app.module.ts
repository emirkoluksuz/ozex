// src/app.module.ts
import { Module, MiddlewareConsumer, NestModule, RequestMethod, OnModuleInit } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";

import { validateEnv } from "./config.validation";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health.controller";
import { WalletModule } from "./wallet/wallet.module";
import { JwtAuthGuard } from "./common/jwt-auth.guard";
import { PrismaModule } from "./prisma/prisma.module";

// Logger
import { LoggerModule } from "nestjs-pino";

// Metrics
import { MetricsModule } from "./metrics/metrics.module";
import { MetricsKeyMiddleware } from "./metrics/metrics-key.middleware";

// Prices
import { PriceModule } from "./price/price.module";
import { PriceService } from "./price/price.service";

// ⭐ Favorites (server-side user favorites)
import { FavoritesModule } from "./auth/favorites.module";

// ⭐ Orders (trade endpoints)
import { OrdersModule } from "./orders/orders.module";
import { OrdersService } from "./orders/orders.service";

// Root controller
import { AppController } from "./app.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),

    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        transport:
          process.env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: {
                  singleLine: true,
                  translateTime: "HH:MM:ss.l",
                  ignore: "pid,hostname",
                },
              }
            : undefined,
        genReqId: (req, res) => {
          const existing = (req.headers["x-request-id"] as string) || undefined;
          const id = existing ?? require("crypto").randomUUID();
          res.setHeader("X-Request-Id", id);
          return id;
        },
        customProps: (req) => ({ requestId: (req as any).id }),
        redact: [
          "req.headers.authorization",
          "req.headers.cookie",
          'res.headers["set-cookie"]',
          "req.body.password",
        ],
      },
    }),

    PrismaModule,
    AuthModule,
    WalletModule,

    // Price engine + WS
    PriceModule,

    // ⭐ User favorites REST (GET/PUT)
    FavoritesModule,

    // ⭐ Trade orders REST
    OrdersModule,

    // /metrics
    MetricsModule,
  ],
  controllers: [HealthController, AppController],
  providers: [
    // 🔒 Global JWT Guard
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    private readonly price: PriceService,
    private readonly orders: OrdersService,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsKeyMiddleware).forRoutes({ path: "metrics", method: RequestMethod.GET });
  }

  async onModuleInit() {
    // Risk motoru bağlama: OrdersService'e PriceService ver ve tick'lerde tetikle
    this.orders.setPriceService(this.price);
    this.price.onChange((s) => {
      try {
        this.orders.onPriceTick(s.symbol, (s as any).current);
      } catch (e: any) {
        // sadece logla
      }
    });

    // MT5 mock kapalı
  }
}
