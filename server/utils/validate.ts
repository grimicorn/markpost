import type {
  ApiError as ApiErrorObject,
  ApiRequest,
} from "../types/api.types";
import { ApiError } from "./errors";

export type AttributeRule = {
  key: string;
  message?: string;
};

const VALIDATION_STATUS = "422";
const VALIDATION_TITLE = "Invalid Attribute";

function titleCase(key: string): string {
  if (!key) {
    return key;
  }

  return key.charAt(0).toUpperCase() + key.slice(1);
}

function defaultMessage(key: string): string {
  return `${titleCase(key)} is required`;
}

function buildError(rule: AttributeRule): ApiErrorObject {
  return {
    status: VALIDATION_STATUS,
    title: VALIDATION_TITLE,
    detail: rule.message ?? defaultMessage(rule.key),
    source: { pointer: `/data/attributes/${rule.key}` },
  };
}

export function apiValidate(body: ApiRequest, rules: AttributeRule[]): void {
  const attributes = body.data.attributes as Record<string, unknown>;
  const errors = rules
    .filter((rule) => !attributes[rule.key])
    .map((rule) => buildError(rule));

  if (errors.length === 0) {
    return;
  }

  throw new ApiError(errors, 422);
}
