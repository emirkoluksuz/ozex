// src/metrics/metrics.module.ts
import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from "@willsoto/nestjs-prometheus";
import { HttpMetricsInterceptor } from "./metrics.interceptor";

@Module({
  imports: [
    // /metrics endpointi + default process metrikleri (tek noktadan)
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
        // config: { prefix: "app_" }, // istersen önek ver
      },
    }),
  ],
  providers: [
    // HTTP istek sayacı
    makeCounterProvider({
      name: "http_requests_total",
      help: "Total number of HTTP requests",
      labelNames: ["method", "route", "status"],
    }),
    // HTTP süre histogramı (saniye)
    makeHistogramProvider({
      name: "http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "route", "status"],
      buckets: [0.025, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
    }),
    // Interceptor'ı kaydet ve global yap
    HttpMetricsInterceptor,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
  exports: [
    PrometheusModule, // gerekirse başka modüllerde de kullan
  ],
})
export class MetricsModule {}
