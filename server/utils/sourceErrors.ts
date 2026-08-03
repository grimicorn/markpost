import { ApiError } from "./errors";

// Shared by every /api/sources/:uuid handler (patch, delete, rotate-secret):
// they all 404 the same way, so the error shape lives here rather than being
// re-declared identically in each file.
export function sourceNotFoundError(): ApiError {
  return new ApiError(
    [
      {
        status: "404",
        title: "Not Found",
        detail: "No source was found for the given uuid.",
      },
    ],
    404,
  );
}
