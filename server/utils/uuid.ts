import { ApiError } from "./errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | undefined | null): value is string {
  if (!value) {
    return false;
  }
  return UUID_PATTERN.test(value);
}

// The sources :uuid routes (patch, delete, rotate-secret) validate this param
// the same way, so the error shape lives next to the validator. Other :uuid
// handlers (records, tokens) still declare their own copy and could adopt this.
export function invalidUuidError(): ApiError {
  return new ApiError(
    [
      {
        status: "400",
        title: "Invalid Parameter",
        detail: "The uuid parameter is missing or malformed.",
        source: { parameter: "uuid" },
      },
    ],
    400,
  );
}
