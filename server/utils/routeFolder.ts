import {
  routeFolderViolation,
  ROUTE_FOLDER_MAX_LENGTH,
  type RouteFolderViolation,
} from "#shared/utils/routeFolder";
import { ApiError } from "./errors";

const ROUTE_FOLDER_POINTER = "/data/attributes/routeFolder";

const VIOLATION_DETAIL: Record<RouteFolderViolation, string> = {
  "not-a-string": "RouteFolder must be a string",
  empty: "RouteFolder must not be empty",
  "too-long": `RouteFolder must be at most ${ROUTE_FOLDER_MAX_LENGTH} characters`,
  absolute:
    "RouteFolder must be a relative path — no leading slash or backslash",
  traversal: "RouteFolder must not contain path traversal segments (..)",
  "unsafe-segment":
    "RouteFolder path segments must not be empty, padded with whitespace, or end in a dot",
  "reserved-name":
    "RouteFolder must not use a reserved device name (CON, PRN, AUX, NUL, COM1-9, LPT1-9)",
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

// Throws a 422 ApiError when routeFolder is not a safe relative path — the sole
// routeFolder validation for both POST and PATCH, including the string-type
// check, so the two endpoints can't drift.
export function assertValidRouteFolder(value: unknown): void {
  if (typeof value !== "string") {
    throw routeFolderError("not-a-string");
  }
  const violation = routeFolderViolation(value);
  if (violation === null) {
    return;
  }
  throw routeFolderError(violation);
}
