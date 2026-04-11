import { ApiError } from "@libs/errors.js";

// @todo Test apiValidateRequest
export const apiValidateRequest = (request: Request, method: string) => {
  if (request.method?.toUpperCase() !== method.toUpperCase()) {
    throw new ApiError(
      {
        errors: [
          {
            status: "405",
            title: "Method Not Allowed",
            detail: `${request.method} method is not allowed`,
          },
        ],
      },
      405,
    );
  }

  const contentType = request.headers.get("Content-Type");
  if (!contentType?.includes("application/vnd.api+json")) {
    throw new ApiError(
      {
        errors: [
          {
            status: "415",
            title: "Unsupported Media Type",
            detail: "Content-Type must be application/vnd.api+json",
          },
        ],
      },
      415,
    );
  }
};
