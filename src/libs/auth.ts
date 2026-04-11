import { ApiError } from "@libs/errors.js";

// @todo Test apiCheckAuth
export const apiCheckAuth = (request: Request) => {
  const authHeader = request.headers.get("Authorization");

  const token = authHeader?.replace(/^Bearer /g, "");

  if (token === process.env.API_TOKEN) {
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
