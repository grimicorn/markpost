// routeFolder crosses a trust boundary: markpost-cli takes it verbatim as a
// relative filesystem path when writing synced markdown. A value like
// "../../etc", "/etc/passwd", or "C:\\Windows" would let a source escape the
// sync directory or point at an absolute location, so the server contract
// rejects traversal, absolute paths, and other filesystem-hazardous characters
// here. This is the one place POST (server/api/sources/index.post.ts) and PATCH
// (server/api/sources/[uuid].patch.ts) share so their rules can't drift.

export const ROUTE_FOLDER_MAX_LENGTH = 255;

// Allowed characters: letters, digits, underscore (all via \w), plus space and
// . - / — enough for nested folders like "notes/work" and the existing
// "05-stripe/" convention. Everything else (backslashes, null bytes, control
// characters, glob/shell metacharacters, colons) is rejected.
const ALLOWED_ROUTE_FOLDER = /^[\w .\-/]+$/;

// A leading drive letter (e.g. "C:") makes a Windows path absolute even without
// a leading separator.
const WINDOWS_DRIVE_PREFIX = /^[A-Za-z]:/;

const TRAVERSAL_SEGMENT = "..";
const PATH_SEPARATOR = "/";

export type RouteFolderViolation =
  "empty" | "too-long" | "absolute" | "traversal" | "invalid-characters";

function hasTraversalSegment(value: string): boolean {
  return value
    .split(PATH_SEPARATOR)
    .some((segment) => segment === TRAVERSAL_SEGMENT);
}

function isAbsolutePath(value: string): boolean {
  if (value.startsWith("/") || value.startsWith("\\")) {
    return true;
  }
  return WINDOWS_DRIVE_PREFIX.test(value);
}

// Returns the first violation found, or null when the value is a safe relative
// path. Callers map the violation to their own error shape.
export function routeFolderViolation(
  value: string,
): RouteFolderViolation | null {
  if (value.trim() === "") {
    return "empty";
  }
  if (value.length > ROUTE_FOLDER_MAX_LENGTH) {
    return "too-long";
  }
  if (isAbsolutePath(value)) {
    return "absolute";
  }
  if (!ALLOWED_ROUTE_FOLDER.test(value)) {
    return "invalid-characters";
  }
  if (hasTraversalSegment(value)) {
    return "traversal";
  }
  return null;
}

export function isValidRouteFolder(value: string): boolean {
  return routeFolderViolation(value) === null;
}
