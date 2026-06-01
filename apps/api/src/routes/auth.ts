import {
  createUser,
  DuplicateUserError,
  getUserById,
  verifyUserPassword,
} from "@repo/db";
import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { HttpError, parseBody } from "../errors";
import { createSession, deleteSession, getStoredSession } from "../sessions";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const logoutSchema = z.object({
  sessionId: z.string().min(1).optional(),
});

export const authRouter: ExpressRouter = Router();

function getSessionIdFromRequest(request: {
  body?: unknown;
  header(name: string): string | undefined;
}): string | undefined {
  const parsedBody = logoutSchema.safeParse(request.body);

  if (parsedBody.success && parsedBody.data.sessionId) {
    return parsedBody.data.sessionId;
  }

  const authorizationHeader = request.header("authorization");

  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.slice("Bearer ".length).trim();
  }

  const headerSessionId = request.header("x-session-id");

  return headerSessionId?.trim() || undefined;
}

authRouter.post("/register", async (request, response, next) => {
  try {
    const input = parseBody(registerSchema, request.body);
    const user = await createUser(input);
    const session = await createSession(user);

    return response.status(201).json(session);
  } catch (error) {
    if (error instanceof DuplicateUserError) {
      next(new HttpError(409, "A user with this email already exists"));
      return;
    }

    next(error);
  }
});

authRouter.post("/login", async (request, response, next) => {
  try {
    const input = parseBody(loginSchema, request.body);
    const user = await verifyUserPassword(input.email, input.password);

    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }

    const session = await createSession(user);

    return response.status(200).json(session);
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", async (request, response, next) => {
  try {
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

    return response.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (request, response, next) => {
  try {
    const sessionId = getSessionIdFromRequest(request);

    if (sessionId) {
      await deleteSession(sessionId);
    }

    return response.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
});
