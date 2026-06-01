import { getRuntimeApiConfig } from "@repo/config/runtime";

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

export interface AuthResponse {
  sessionId: string;
  expiresAt: string;
  user: ApiUser;
}

interface UserResponse {
  user: ApiUser;
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function requestApi<TResponse>(
  path: string,
  init: RequestInit,
): Promise<TResponse> {
  const apiConfig = getRuntimeApiConfig();

  const response = await fetch(`${apiConfig.url}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | TResponse
    | null;

  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "The API request failed";

    throw new ApiError(response.status, message);
  }

  return body as TResponse;
}

export async function registerUser(input: RegisterInput): Promise<ApiUser> {
  const response = await requestApi<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.user;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  return requestApi<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  return requestApi<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getCurrentUser(sessionId: string): Promise<ApiUser> {
  const response = await requestApi<UserResponse>("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionId}`,
    },
  });

  return response.user;
}

export async function logout(sessionId: string): Promise<void> {
  await requestApi<{ ok: true }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}
