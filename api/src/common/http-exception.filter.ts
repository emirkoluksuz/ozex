// src/common/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ZodError } from "zod";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>() as Request & { id?: string };

    // 🛡️ 0) Eğer header/body zaten gitmişse hiç dokunma
    if (res.headersSent || (res as any).writableEnded) {
      this.logger.warn({
        msg: "Response already sent; skipping error serialization",
        path: req.originalUrl,
      });
      return; // ikinci kez yazmaya çalışma
    }

    const requestId = req.id ?? String(req.headers["x-request-id"] ?? "");
    if (requestId) {
      res.setHeader("X-Request-Id", requestId);
    }

    // 1) Zod doğrulama hataları
    if (exception instanceof ZodError) {
      const errors = exception.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      const message = errors.map((e) => `${e.path}: ${e.message}`).join("; ");
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        status: HttpStatus.BAD_REQUEST,
        path: req.originalUrl,
        timestamp: new Date().toISOString(),
        message,
        errors,
        requestId,
      });
    }

    // 2) Nest HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse() as any;
      const message =
        typeof resp === "string"
          ? resp
          : Array.isArray(resp?.message)
          ? resp.message.join("; ")
          : resp?.message || exception.message;

      if (status >= 500) {
        this.logger.error(
          { requestId, status, path: req.originalUrl, message },
          (exception as any)?.stack,
        );
      } else {
        this.logger.warn({ requestId, status, path: req.originalUrl, message });
      }

      return res.status(status).json({
        success: false,
        status,
        path: req.originalUrl,
        timestamp: new Date().toISOString(),
        message,
        requestId,
      });
    }

    // 3) Beklenmeyen hatalar
    this.logger.error(
      { requestId, path: req.originalUrl, err: String(exception) },
      (exception as any)?.stack,
    );

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
      message: "Internal server error",
      requestId,
    });
  }
}
