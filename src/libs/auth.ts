import { ApiError } from "@libs/errors";

export const apiCheckAuth = (request: Request) => {
  const authHeader = request.headers.get("Authorization");

  if (
    authHeader?.startsWith("Bearer ") &&
    authHeader.slice(7) === process.env.API_TOKEN
  ) {
    return;
  }

  throw new ApiError(
    {
      errors: [
        {
          status: "401",
          title: "Unauthorized",
          detail: "A valid API token is required.",
        },
      ],
    },
    401,
  );
};
