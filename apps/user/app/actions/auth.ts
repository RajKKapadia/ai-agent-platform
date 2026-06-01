"use server";

import { ApiError, login, register } from "@/lib/api";
import { logoutCurrentSession, setSessionCookie } from "@/lib/session";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export interface AuthActionState {
  error?: string;
  fieldErrors?: {
    name?: string[];
    email?: string[];
    password?: string[];
  };
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: getString(formData, "email"),
    password: getString(formData, "password"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const authSession = await login(parsed.data);
    await setSessionCookie(authSession.sessionId, authSession.expiresAt);
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        error: error.message,
      };
    }

    throw error;
  }

  redirect("/dashboard");
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    name: getString(formData, "name"),
    email: getString(formData, "email"),
    password: getString(formData, "password"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const authSession = await register(parsed.data);
    await setSessionCookie(authSession.sessionId, authSession.expiresAt);
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        error: error.message,
      };
    }

    throw error;
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  await logoutCurrentSession();
  redirect("/login");
}
