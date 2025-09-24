// src/config.validation.ts
import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("10m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

  // CORS / CSP
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  CSP_CONNECT_SRC: z
    .string()
    .default("http://localhost:3000,http://localhost:4000,ws://localhost:4000"),

  // Node env
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("4000"),

  // Admin
  ADMIN_API_KEY: z.string().min(20),

  // Price system
  PRICE_SOURCE: z.enum(["OLD", "TV", "HYBRID"]).default("TV"),
  ENABLE_TV_BRIDGE: z.string().default("1"), // "1" veya "0"
  TV_BRIDGE_SHARED_SECRET: z.string().optional(), // prod’da zorunlu tutabilirsin
  TV_ALLOWED_SOURCES: z.string().optional(),

  // Metrics
  METRICS_KEY: z.string().min(10).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    throw new Error("Invalid environment: " + msg);
  }
  return parsed.data;
}
