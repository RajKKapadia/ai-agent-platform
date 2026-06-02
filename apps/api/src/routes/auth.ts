import { createUser, DuplicateUserError, verifyUserPassword } from "@repo/db";
import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { getSessionIdFromRequest, requireAuthenticatedUser } from "../auth";
import { HttpError, parseBody } from "../errors";
import { createSession, deleteSession } from "../sessions";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.email("Enter a valid email address").trim(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.email("Enter a valid email address").trim(),
  password: z.string().min(1, "Password is required"),
});

export const authRouter: ExpressRouter = Router();

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
    const { user } = await requireAuthenticatedUser(request);

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
