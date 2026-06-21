import type { ApiError as ApiErrorObject } from "../types/api.types";

export class ApiError extends Error {
  readonly errors: ApiErrorObject[];
  readonly statusCode: number;

  constructor(errors: ApiErrorObject[], statusCode: number) {
    super(`ApiError: ${statusCode}`);
    this.errors = errors;
    this.statusCode = statusCode;
  }
}

export function apiErrorHandler(error: unknown): never {
  if (error instanceof ApiError) {
    throw createError({
      statusCode: error.statusCode,
      data: { errors: error.errors },
    });
  }

  console.error("[apiErrorHandler] Unexpected error:", error);

  throw createError({
    statusCode: 500,
    statusMessage: "Internal Server Error",
  });
}
