import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction) {
    const rid = String(req.headers["x-request-id"] ?? randomUUID());
    req.id = rid;
    res.setHeader("X-Request-Id", rid);
    next();
  }
}
