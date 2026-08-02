// routeFolder crosses a trust boundary: markpost-cli takes it verbatim as a
// relative filesystem path when writing synced markdown. A value like
// "../../etc", "/etc/passwd", or "notes\\work" would let a source escape the
// sync directory or point at an absolute location, so this contract rejects
// traversal, absolute paths, and filesystem-hazardous characters. This is the
// one place POST (server/api/sources/index.post.ts) and PATCH
// (server/api/sources/[uuid].patch.ts) share so their safety rules can't drift.
// Presence/required is still enforced separately on POST (routeFolder is
// mandatory at creation but an optional field on PATCH).
//
// Scope: this validates values at write time only. Rows written before this
// existed, and the CLI's own read path, are not covered here.

export const ROUTE_FOLDER_MAX_LENGTH = 255;

// Allowed characters: Unicode letters and numbers plus space and . _ - / —
// enough for nested folders like "notes/work", accented names like "año", and
// the existing "05-stripe/" convention. Everything else (backslashes, colons,
// null bytes, control characters, glob/shell metacharacters) is rejected.
// Values are NFC-normalized first, so a macOS-style NFD "año" is accepted
// rather than rejected for its combining mark.
const ALLOWED_ROUTE_FOLDER = /^[\p{L}\p{N} ._\-/]+$/u;

const PATH_SEPARATOR = "/";

// A component made only of two-or-more dots ("..", "...") is parent-directory
// traversal. Windows also strips trailing dots and spaces, so ".. " normalizes
// to ".." — comparison is done against the trimmed component to catch that.
const TRAVERSAL_SEGMENT = /^\.{2,}$/;

// Windows reserved device names. Writing to "CON", "NUL", "COM1", etc. (any
// case, with or without an extension) targets a character device rather than a
// file, so reject them as path components. Windows also treats the superscript
// digits (COM¹/COM²/COM³) as their ASCII equivalents, so those are covered too.
const RESERVED_SEGMENT = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(\.|$)/i;

export type RouteFolderViolation =
  | "not-a-string"
  | "empty"
  | "too-long"
  | "absolute"
  | "traversal"
  | "unsafe-segment"
  | "reserved-name"
  | "invalid-characters";

function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || value.startsWith("\\");
}

function segments(value: string): string[] {
  return value.split(PATH_SEPARATOR);
}

function hasTraversalSegment(value: string): boolean {
  return segments(value).some((segment) =>
    TRAVERSAL_SEGMENT.test(segment.trim()),
  );
}

// Windows strips trailing dots and spaces from each path component, so
// "notes." and "notes " collide with "notes"; leading/trailing whitespace and
// empty interior components ("a//b") likewise produce ambiguous or
// unrepresentable directory names. A single trailing slash ("notes/") is fine.
function isUnsafeSegment(segment: string, isLast: boolean): boolean {
  if (segment === "") {
    return !isLast;
  }
  if (segment.trim() !== segment) {
    return true;
  }
  return segment.endsWith(".");
}

function hasUnsafeSegment(value: string): boolean {
  const parts = segments(value);
  const lastIndex = parts.length - 1;
  return parts.some((segment, index) =>
    isUnsafeSegment(segment, index === lastIndex),
  );
}

function hasReservedSegment(value: string): boolean {
  return segments(value).some((segment) => RESERVED_SEGMENT.test(segment));
}

// Returns the first violation found, or null when the value is a safe relative
// path. Callers map the violation to their own error shape.
export function routeFolderViolation(
  value: string,
): RouteFolderViolation | null {
  const normalized = value.normalize("NFC");

  if (normalized.trim() === "") {
    return "empty";
  }
  if (normalized.length > ROUTE_FOLDER_MAX_LENGTH) {
    return "too-long";
  }
  if (isAbsolutePath(normalized)) {
    return "absolute";
  }
  if (!ALLOWED_ROUTE_FOLDER.test(normalized)) {
    return "invalid-characters";
  }
  if (hasTraversalSegment(normalized)) {
    return "traversal";
  }
  if (hasUnsafeSegment(normalized)) {
    return "unsafe-segment";
  }
  if (hasReservedSegment(normalized)) {
    return "reserved-name";
  }
  return null;
}
