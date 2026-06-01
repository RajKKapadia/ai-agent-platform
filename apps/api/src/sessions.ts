import { appConfig } from "@repo/config";
import type { PublicUser, UserRole } from "@repo/db";
import { randomBytes } from "node:crypto";
import { createClient } from "redis";

const sessionKeyPrefix = "session:";

interface StoredSession {
  userId: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthSession {
  sessionId: string;
  expiresAt: string;
  user: PublicUser;
}

const createRedisClient = () => {
  const client = createClient({
    url: appConfig.redis.url,
  });

  client.on("error", (error) => {
    console.error("Redis client error", error);
  });

  return client;
};

type RedisClient = ReturnType<typeof createRedisClient>;

const globalForRedis = globalThis as typeof globalThis & {
  __redisClient?: RedisClient;
};

async function getRedisClient(): Promise<RedisClient> {
  const client = globalForRedis.__redisClient ?? createRedisClient();
  globalForRedis.__redisClient = client;

  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

function getSessionKey(sessionId: string): string {
  return `${sessionKeyPrefix}${sessionId}`;
}

function createSessionId(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(user: PublicUser): Promise<AuthSession> {
  const sessionId = createSessionId();
  const ttlSeconds = appConfig.session.ttlSeconds;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const payload: StoredSession = {
    userId: user.id,
    role: user.role,
    createdAt: new Date().toISOString(),
  };

  const redis = await getRedisClient();
  await redis.set(getSessionKey(sessionId), JSON.stringify(payload), {
    EX: ttlSeconds,
  });

  return {
    sessionId,
    expiresAt,
    user,
  };
}

export async function getStoredSession(
  sessionId: string,
): Promise<StoredSession | null> {
  const redis = await getRedisClient();
  const value = await redis.get(getSessionKey(sessionId));

  if (!value) {
    return null;
  }

  return JSON.parse(value) as StoredSession;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const redis = await getRedisClient();
  await redis.del(getSessionKey(sessionId));
}
