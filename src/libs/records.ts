import type { Record } from "@t/record.types";

export const standardizeRecordResponse = (record?: Record | null) => {
  if (!record) {
    return null;
  }

  return {
    type: "records",
    id: record.uuid,
    attributes: record,
    links: {
      self: `/api/records/${record.uuid}`,
    },
  };
};
