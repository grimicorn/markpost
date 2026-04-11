import { apiResponse } from "@libs/response.js";

export class ApiError extends Error {
  response: Response;

  constructor(body: object, status: number) {
    super();
    this.response = apiResponse(body, status);
  }
}

// @todo Test apiErrorHandler
export const apiErrorHandler = (error: Error): Response => {
  if (error instanceof ApiError) {
    return error.response;
  }

  console.error(error);

  return apiResponse(
    {
      errors: [
        {
          status: "500",
          title: "Internal Server Error",
          detail: "Unknown error occurred.",
        },
      ],
    },
    500,
  );
};
