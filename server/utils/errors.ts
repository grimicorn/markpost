import type { ApiError as ApiErrorObject } from "../types/api.types";

export class ApiError extends Error {
  readonly errors: ApiErrorObject[];
  readonly statusCode: number;

  constructor(errors: ApiErrorObject[], statusCode: number) {
    if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
      throw new RangeError(
        "ApiError statusCode must be an integer between 400 and 599",
      );
    }
    super(`ApiError: ${statusCode}`);
    this.errors = errors;
    this.statusCode = statusCode;
  }
}

function isHttpError(error: unknown): error is { statusCode: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  );
}

export function apiErrorHandler(error: unknown): never {
  if (error instanceof ApiError) {
    throw createError({
      statusCode: error.statusCode,
      data: { errors: error.errors },
    });
  }

  // Errors thrown via createError (e.g. the 401 from requireUser) already carry
  // an HTTP statusCode and are client-facing; re-throw them untouched rather
  // than masking them as a generic 500.
  if (isHttpError(error)) {
    throw error;
  }

  console.error("[apiErrorHandler] Unexpected error:", error);

  throw createError({
    statusCode: 500,
    statusMessage: "Internal Server Error",
  });
}
