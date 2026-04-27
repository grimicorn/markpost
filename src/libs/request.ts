import { ApiError } from "@libs/errors";

export const apiValidateRequest = (
  request: Request,
  method: string,
  requireContentType = true,
) => {
  if (request.method?.toUpperCase() !== method.toUpperCase()) {
    throw new ApiError(
      [
        {
          status: "405",
          title: "Method Not Allowed",
          detail: `${request.method} method is not allowed`,
        },
      ],
      405,
    );
  }

  const contentType = request.headers.get("Content-Type");
  if (requireContentType && !contentType?.includes("application/json")) {
    throw new ApiError(
      [
        {
          status: "415",
          title: "Unsupported Media Type",
          detail: "Content-Type must be application/json",
        },
      ],
      415,
    );
  }
};
