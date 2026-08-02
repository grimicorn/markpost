import { describe, it, expect } from "vitest";
import {
  isValidRouteFolder,
  routeFolderViolation,
  ROUTE_FOLDER_MAX_LENGTH,
} from "#shared/utils/routeFolder";

describe("routeFolderViolation", () => {
  const validFolders = [
    "notes",
    "notes/work",
    "05-stripe/",
    "99-incoming/",
    "a/b/c",
    "with space/sub_folder",
    "dot.in.name",
  ];

  it.each(validFolders)("accepts the legitimate folder %j", (value) => {
    expect(routeFolderViolation(value)).toBeNull();
    expect(isValidRouteFolder(value)).toBe(true);
  });

  it("rejects an empty or whitespace-only value", () => {
    expect(routeFolderViolation("")).toBe("empty");
    expect(routeFolderViolation("   ")).toBe("empty");
  });

  it("rejects a value longer than the max length", () => {
    expect(routeFolderViolation("a".repeat(ROUTE_FOLDER_MAX_LENGTH + 1))).toBe(
      "too-long",
    );
    expect(
      routeFolderViolation("a".repeat(ROUTE_FOLDER_MAX_LENGTH)),
    ).toBeNull();
  });

  const absolutePaths = [
    "/etc/passwd",
    "/notes",
    "\\network\\share",
    "C:/Windows",
    "c:\\temp",
  ];

  it.each(absolutePaths)("rejects the absolute path %j", (value) => {
    expect(routeFolderViolation(value)).toBe("absolute");
  });

  const traversalPaths = [
    "..",
    "../etc",
    "../../etc",
    "notes/../../../etc",
    "a/b/..",
  ];

  it.each(traversalPaths)("rejects the traversal path %j", (value) => {
    expect(routeFolderViolation(value)).toBe("traversal");
  });

  const hazardousCharacters = [
    "notes\\work",
    "notes\0hidden",
    "notes;rm -rf",
    "notes*",
    "notes?",
    "a\nb",
    "notes:colon",
  ];

  it.each(hazardousCharacters)(
    "rejects hazardous characters in %j",
    (value) => {
      expect(routeFolderViolation(value)).toBe("invalid-characters");
    },
  );

  it("treats a single dot segment as a valid relative path (not traversal)", () => {
    expect(routeFolderViolation("./notes")).toBeNull();
  });
});
