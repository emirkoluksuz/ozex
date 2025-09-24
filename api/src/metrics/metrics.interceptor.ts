// src/metrics/metrics.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import type { Counter, Histogram } from "prom-client";

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  private static readonly EXCLUDED_ROUTES = new Set<string>([
    "/metrics", // Prometheus scrape'ini sayma
  ]);

  constructor(
    @InjectMetric("http_requests_total")
    private readonly counter: Counter<string>,
    @InjectMetric("http_request_duration_seconds")
    private readonly histogram: Histogram<string>,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();

    // Route label: mümkünse controller route şablonu (id'leri içermez)
    const route =
      req?.route?.path ??
      (req?.originalUrl ? String(req.originalUrl).split("?")[0] : "unknown");

    const method = (req?.method ?? "UNKNOWN").toUpperCase();

    // Self/OPTIONS isteklerini metriklerden hariç tut
    if (
      method === "OPTIONS" ||
      HttpMetricsInterceptor.EXCLUDED_ROUTES.has(route)
    ) {
      return next.handle();
    }

    const start = process.hrtime.bigint();

    const record = (statusCode: number) => {
      const status = String(statusCode ?? 0);
      this.counter.labels(method, route, status).inc();

      const end = process.hrtime.bigint();
      const seconds = Number(end - start) / 1e9;
      this.histogram.labels(method, route, status).observe(seconds);
    };

    return next.handle().pipe(
      tap({
        next: () => {
          // Başarılı/complete durumda response status'undan al
          record(res?.statusCode ?? 200);
        },
        error: (err) => {
          // Hata durumunda Nest HttpException status'u varsa onu kullan, yoksa 500
          const status =
            (typeof err?.getStatus === "function" ? err.getStatus() : err?.status) ??
            500;
          record(status);
        },
      }),
    );
  }
}
