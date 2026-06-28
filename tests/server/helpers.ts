import { vi } from "vitest";

export function createMockCreateError() {
  return vi.fn((options: object) => {
    const error = new Error("createError");
    Object.assign(error, options);
    return error;
  });
}
