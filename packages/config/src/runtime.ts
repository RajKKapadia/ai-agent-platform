import { z } from "zod";

const runtimeSchema = z.object({
  API_URL: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  SESSION_COOKIE_NAME: z.string().min(1).default("session_id"),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
});

export interface RuntimeApiConfig {
  url: string;
  publicUrl: string;
  corsOrigin: string;
}

export interface RuntimeSessionConfig {
  cookieName: string;
  ttlSeconds: number;
}

export interface RuntimeRedisConfig {
  url: string;
}

export interface RuntimeConfig {
  api: RuntimeApiConfig;
  redis: RuntimeRedisConfig;
  session: RuntimeSessionConfig;
}

export function getRuntimeConfig(): RuntimeConfig {
  const env = runtimeSchema.parse(process.env);

  return {
    api: {
      url: env.API_URL,
      publicUrl: env.NEXT_PUBLIC_API_URL ?? env.API_URL,
      corsOrigin: env.CORS_ORIGIN,
    },
    redis: {
      url: env.REDIS_URL,
    },
    session: {
      cookieName: env.SESSION_COOKIE_NAME,
      ttlSeconds: env.SESSION_TTL_SECONDS,
    },
  };
}

export function getRuntimeApiConfig(): RuntimeApiConfig {
  return getRuntimeConfig().api;
}

export function getRuntimeRedisConfig(): RuntimeRedisConfig {
  return getRuntimeConfig().redis;
}

export function getRuntimeSessionConfig(): RuntimeSessionConfig {
  return getRuntimeConfig().session;
}
