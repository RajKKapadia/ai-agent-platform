import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(
        400,
        error.issues.map((issue) => issue.message).join("; "),
      );
    }

    throw error;
  }
}

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  void next;

  if (error instanceof HttpError) {
    return response.status(error.statusCode).json({
      error: error.message,
    });
  }

  console.error(error);

  return response.status(500).json({
    error: "Internal server error",
  });
}
