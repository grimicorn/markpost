import { and, eq, isNotNull, like } from "drizzle-orm";
import { getDb } from "../db";
import { records } from "../db/schema";

// Webhook/email records derive filePath from date+slug+source only, so two
// ingests that collapse to the same "{{date}}-{{slug}}.md" map to one file and
// the CLI sync silently overwrites one record's file with another. We give each
// colliding record a distinct path by appending a numeric suffix before the
// extension: the first record keeps the clean name, the next becomes
// "…-2.md", then "…-3.md", and so on. Non-colliding records are untouched.

const COLLISION_SUFFIX_START = 2;

function splitExtension(filename: string): { base: string; ext: string } {
  const dotIndex = filename.lastIndexOf(".");
  // A leading-dot name (".keep") or a name with no dot has no extension to
  // preserve, so the whole thing is the base.
  if (dotIndex <= 0) {
    return { base: filename, ext: "" };
  }

  return { base: filename.slice(0, dotIndex), ext: filename.slice(dotIndex) };
}

function splitDirectory(filePath: string): { dir: string; filename: string } {
  const slashIndex = filePath.lastIndexOf("/");
  if (slashIndex === -1) {
    return { dir: "", filename: filePath };
  }

  return {
    dir: filePath.slice(0, slashIndex + 1),
    filename: filePath.slice(slashIndex + 1),
  };
}

function withSuffix(filePath: string, suffix: number): string {
  const { dir, filename } = splitDirectory(filePath);
  const { base, ext } = splitExtension(filename);
  return `${dir}${base}-${suffix}${ext}`;
}

export function resolveUniqueFilePath(
  desiredPath: string,
  takenPaths: Set<string>,
): string {
  if (!takenPaths.has(desiredPath)) {
    return desiredPath;
  }

  let suffix = COLLISION_SUFFIX_START;
  let candidate = withSuffix(desiredPath, suffix);

  while (takenPaths.has(candidate)) {
    suffix += 1;
    candidate = withSuffix(desiredPath, suffix);
  }

  return candidate;
}

// Prefix pattern matching the desired name and every numbered variant of it
// ("2026-01-01-hello.md" and "2026-01-01-hello-2.md"). It intentionally
// over-matches (e.g. "2026-01-01-hello-world.md"); an unrelated row in the
// taken set never equals a generated candidate, so a superset is harmless and
// keeps the query a single indexed range scan.
function collisionPrefixPattern(desiredPath: string): string {
  const { dir, filename } = splitDirectory(desiredPath);
  const { base } = splitExtension(filename);
  return `${dir}${base}%`;
}

async function fetchTakenFilePaths(
  userId: string,
  desiredPath: string,
): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ filePath: records.filePath })
    .from(records)
    .where(
      and(
        eq(records.userId, userId),
        isNotNull(records.filePath),
        like(records.filePath, collisionPrefixPattern(desiredPath)),
      ),
    );

  const takenPaths = new Set<string>();
  for (const row of rows) {
    if (row.filePath !== null) {
      takenPaths.add(row.filePath);
    }
  }

  return takenPaths;
}

// Returns desiredPath unchanged when no record for this user already owns it,
// otherwise the first free numbered variant. Isolated from the pure resolver
// above so the suffixing logic is testable without a database.
export async function ensureUniqueFilePath(
  userId: string,
  desiredPath: string,
): Promise<string> {
  const takenPaths = await fetchTakenFilePaths(userId, desiredPath);
  return resolveUniqueFilePath(desiredPath, takenPaths);
}
