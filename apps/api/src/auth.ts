import { getUserById, type PublicUser } from "@repo/db";
import type { Request } from "express";
import { HttpError } from "./errors";
import { getStoredSession } from "./sessions";

export interface AuthenticatedUser {
  sessionId: string;
  user: PublicUser;
}

export function getSessionIdFromRequest(request: Request): string | undefined {
  const body = request.body;

  if (
    body &&
    typeof body === "object" &&
    "sessionId" in body &&
    typeof body.sessionId === "string" &&
    body.sessionId.trim()
  ) {
    return body.sessionId.trim();
  }

  const authorizationHeader = request.header("authorization");

  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length).trim();
  }

  const headerSessionId = request.header("x-session-id");

  return headerSessionId?.trim() || undefined;
}

export async function requireAuthenticatedUser(
  request: Request,
): Promise<AuthenticatedUser> {
  const sessionId = getSessionIdFromRequest(request);

  if (!sessionId) {
    throw new HttpError(401, "Missing session id");
  }

  const session = await getStoredSession(sessionId);

  if (!session) {
    throw new HttpError(401, "Invalid or expired session");
  }

  const user = await getUserById(session.userId);

  if (!user) {
    throw new HttpError(401, "Invalid session user");
  }

  return { sessionId, user };
}
