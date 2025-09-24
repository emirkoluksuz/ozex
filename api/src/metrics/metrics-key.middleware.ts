// src/metrics/metrics-key.middleware.ts
import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";

@Injectable()
export class MetricsKeyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Sadece /metrics için devrede
    if (req.path !== "/metrics") return next();

    // ✅ A Seçeneği: Development/staging'de serbest bırak
    if (process.env.NODE_ENV !== "production") return next();

    // Prod'da paylaşımlı anahtar kontrolü (env yoksa serbest bırakma)
    const expected = process.env.METRICS_KEY;
    if (!expected) return next();

    const key = req.header("x-metrics-key");
    if (key === expected) return next();

    return res.status(401).send("Unauthorized");
  }
}
