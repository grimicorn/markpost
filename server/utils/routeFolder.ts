import {
  routeFolderViolation,
  ROUTE_FOLDER_MAX_LENGTH,
  type RouteFolderViolation,
} from "#shared/utils/routeFolder";
import { ApiError } from "./errors";

const ROUTE_FOLDER_POINTER = "/data/attributes/routeFolder";

const VIOLATION_DETAIL: Record<RouteFolderViolation, string> = {
  empty: "RouteFolder must not be empty",
  "too-long": `RouteFolder must be at most ${ROUTE_FOLDER_MAX_LENGTH} characters`,
  absolute:
    "RouteFolder must be a relative path — no leading slash, backslash, or drive letter",
  traversal: "RouteFolder must not contain path traversal segments (..)",
  "unsafe-segment":
    "RouteFolder path segments must not be empty, padded with whitespace, or end in a dot",
  "invalid-characters":
    "RouteFolder may only contain letters, numbers, spaces, and . _ - /",
};

function routeFolderError(violation: RouteFolderViolation): ApiError {
  return new ApiError(
    [
      {
        status: "422",
        title: "Invalid Attribute",
        detail: VIOLATION_DETAIL[violation],
        source: { pointer: ROUTE_FOLDER_POINTER },
      },
    ],
    422,
  );
}

// Throws a 422 ApiError when routeFolder is not a safe relative path. Callers
// must have already confirmed the value is a string. Shared by POST and PATCH
// so the trust-boundary rules stay in one place.
export function assertValidRouteFolder(value: string): void {
  const violation = routeFolderViolation(value);
  if (violation === null) {
    return;
  }
  throw routeFolderError(violation);
}
