import { describe, it, expect } from "vitest";
import { standardizeRecordResponse } from "@libs/records";
import type { Record } from "@t/record.types";

const MOCK_RECORD: Record = {
  uuid: "00000000-0000-0000-0000-000000000001",
  createdAt: "2026-04-11T00:00:00.000Z",
  title: "Hello",
  content: "World",
};

describe("standardizeRecordResponse", () => {
  describe("falsy record", () => {
    it("returns null when record is null", () => {
      expect(standardizeRecordResponse(null)).toBeNull();
    });

    it("returns null when record is undefined", () => {
      expect(standardizeRecordResponse(undefined)).toBeNull();
    });
  });

  describe("valid record", () => {
    it("returns the correct type", () => {
      const result = standardizeRecordResponse(MOCK_RECORD);
      expect(result?.type).toBe("records");
    });

    it("sets id from record uuid", () => {
      const result = standardizeRecordResponse(MOCK_RECORD);
      expect(result?.id).toBe(MOCK_RECORD.uuid);
    });

    it("sets attributes to the full record", () => {
      const result = standardizeRecordResponse(MOCK_RECORD);
      expect(result?.attributes).toEqual(MOCK_RECORD);
    });

    it("sets the self link", () => {
      const result = standardizeRecordResponse(MOCK_RECORD);
      expect(result?.links.self).toBe(`/api/records/${MOCK_RECORD.uuid}`);
    });
  });
});
