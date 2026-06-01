import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const packageRoot = resolve(currentDir, "..");
const repoRoot = resolve(packageRoot, "..", "..");

const envFileNames = [".env.local", ".env"] as const;

let loadedEnvFiles: string[] | undefined;

export const envSchema = z
  .object({
    APP_NAME: z.string().min(1).default("AI Agent Platform"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    API_PORT: z.coerce.number().int().positive().default(4000),
    API_URL: z.string().url().default("http://localhost:4000"),
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
    CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1).optional(),
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    SESSION_COOKIE_NAME: z.string().min(1).default("session_id"),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  })
  .passthrough();

export type Env = z.infer<typeof envSchema>;
export type EnvName = keyof Env | (string & {});

export interface AppConfig {
  appName: string;
  env: Env["NODE_ENV"];
  isDevelopment: boolean;
  isProduction: boolean;
  api: {
    url: string;
    publicUrl: string;
    corsOrigin: string;
  };
  server: {
    port: number;
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  session: {
    cookieName: string;
    ttlSeconds: number;
  };
}

export function loadEnvFiles(options: { force?: boolean } = {}): string[] {
  if (loadedEnvFiles && !options.force) {
    return loadedEnvFiles;
  }

  const searchRoots = Array.from(new Set([process.cwd(), repoRoot]));
  const loaded: string[] = [];

  for (const root of searchRoots) {
    for (const fileName of envFileNames) {
      const envPath = resolve(root, fileName);

      if (!existsSync(envPath)) {
        continue;
      }

      dotenv.config({ path: envPath });
      loaded.push(envPath);
    }
  }

  loadedEnvFiles = loaded;
  return loaded;
}

export function getEnv(): Env {
  loadEnvFiles();

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment variables: ${details}`);
  }

  return parsed.data;
}

export function getEnvValue(name: EnvName): string | undefined {
  loadEnvFiles();
  return process.env[name];
}

export function requireEnv(name: EnvName): string {
  const value = getEnvValue(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getAppConfig(): AppConfig {
  const env = getEnv();

  return {
    appName: env.APP_NAME,
    env: env.NODE_ENV,
    isDevelopment: env.NODE_ENV === "development",
    isProduction: env.NODE_ENV === "production",
    api: {
      url: env.API_URL,
      publicUrl: env.NEXT_PUBLIC_API_URL ?? env.API_URL,
      corsOrigin: env.CORS_ORIGIN,
    },
    server: {
      port: env.API_PORT,
    },
    database: {
      url: requireEnv("DATABASE_URL"),
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

export const appConfig: AppConfig = {
  get appName() {
    return getEnv().APP_NAME;
  },
  get env() {
    return getEnv().NODE_ENV;
  },
  get isDevelopment() {
    return getEnv().NODE_ENV === "development";
  },
  get isProduction() {
    return getEnv().NODE_ENV === "production";
  },
  get api() {
    const env = getEnv();

    return {
      url: env.API_URL,
      publicUrl: env.NEXT_PUBLIC_API_URL ?? env.API_URL,
      corsOrigin: env.CORS_ORIGIN,
    };
  },
  get server() {
    return {
      port: getEnv().API_PORT,
    };
  },
  get database() {
    return {
      url: requireEnv("DATABASE_URL"),
    };
  },
  get redis() {
    return {
      url: getEnv().REDIS_URL,
    };
  },
  get session() {
    const env = getEnv();

    return {
      cookieName: env.SESSION_COOKIE_NAME,
      ttlSeconds: env.SESSION_TTL_SECONDS,
    };
  },
};
