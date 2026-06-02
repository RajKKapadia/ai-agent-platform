import "server-only";

import {
  getCurrentUser as fetchCurrentUser,
  logout as logoutApi,
} from "@/lib/api";
import type { ApiUser } from "@/lib/api-types";
import { getRuntimeSessionConfig } from "@repo/config/runtime";
import { cookies } from "next/headers";

function getCookieOptions(expiresAt?: string) {
  const sessionConfig = getRuntimeSessionConfig();

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionConfig.ttlSeconds,
    expires: expiresAt ? new Date(expiresAt) : undefined,
  };
}

export async function getSessionId(): Promise<string | undefined> {
  const sessionConfig = getRuntimeSessionConfig();
  const cookieStore = await cookies();

  return cookieStore.get(sessionConfig.cookieName)?.value;
}

export async function setSessionCookie(
  sessionId: string,
  expiresAt?: string,
): Promise<void> {
  const sessionConfig = getRuntimeSessionConfig();
  const cookieStore = await cookies();

  cookieStore.set(
    sessionConfig.cookieName,
    sessionId,
    getCookieOptions(expiresAt),
  );
}

export async function clearSessionCookie(): Promise<void> {
  const sessionConfig = getRuntimeSessionConfig();
  const cookieStore = await cookies();

  cookieStore.delete(sessionConfig.cookieName);
}

export async function getCurrentUser(): Promise<ApiUser | null> {
  const sessionId = await getSessionId();

  if (!sessionId) {
    return null;
  }

  try {
    return await fetchCurrentUser(sessionId);
  } catch {
    return null;
  }
}

export async function logoutCurrentSession(): Promise<void> {
  const sessionId = await getSessionId();

  if (sessionId) {
    await logoutApi(sessionId).catch(() => undefined);
  }

  await clearSessionCookie();
}
