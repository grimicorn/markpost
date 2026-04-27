import type { ApiError as ApiErrorType } from "@/types/api.types";
import { apiResponse } from "@libs/response";

export class ApiError extends Error {
  response: Response;

  constructor(errors: ApiErrorType[], status: number) {
    super();
    this.response = apiResponse({ data: { errors } }, status);
  }
}

export const apiErrorHandler = (error: Error): Response => {
  if (error instanceof ApiError) {
    return error.response;
  }

  console.error(error);

  return apiResponse(
    {
      data: {
        errors: [
          {
            status: "500",
            title: "Internal Server Error",
            detail: "Unknown error occurred.",
          },
        ],
      },
    },
    500,
  );
};
