import { describe, expect, it } from "vitest";
import { records } from "../server/db/schema";

describe("records schema", () => {
  it("includes a userId column", () => {
    expect(records.userId).toBeDefined();
  });

  it("userId column is not nullable", () => {
    expect(records.userId.notNull).toBe(true);
  });

  it("userId column maps to user_id in the database", () => {
    expect(records.userId.name).toBe("user_id");
  });
});
