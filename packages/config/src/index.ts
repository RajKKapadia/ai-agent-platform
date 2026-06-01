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
    DATABASE_URL: z.string().min(1).optional(),
  })
  .passthrough();

export type Env = z.infer<typeof envSchema>;
export type EnvName = keyof Env | (string & {});

export interface AppConfig {
  appName: string;
  env: Env["NODE_ENV"];
  isDevelopment: boolean;
  isProduction: boolean;
  database: {
    url: string;
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
    database: {
      url: requireEnv("DATABASE_URL"),
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
  get database() {
    return {
      url: requireEnv("DATABASE_URL"),
    };
  },
};
