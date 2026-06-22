import type {
  ApiError as ApiErrorObject,
  ApiRequest,
} from "../types/api.types";
import { ApiError } from "./errors";

export type AttributeRule = {
  key: string;
  message?: string;
  type?: "string";
};

const VALIDATION_STATUS = "422";
const VALIDATION_TITLE = "Invalid Attribute";

function titleCase(key: string): string {
  if (!key) {
    return key;
  }

  return key.charAt(0).toUpperCase() + key.slice(1);
}

function requiredMessage(key: string): string {
  return `${titleCase(key)} is required`;
}

function typeMessage(key: string, type: string): string {
  return `${titleCase(key)} must be a ${type}`;
}

function buildError(rule: AttributeRule, detail: string): ApiErrorObject {
  return {
    status: VALIDATION_STATUS,
    title: VALIDATION_TITLE,
    detail,
    source: { pointer: `/data/attributes/${rule.key}` },
  };
}

function validateRule(
  attributes: Record<string, unknown>,
  rule: AttributeRule,
): ApiErrorObject | null {
  const value = attributes[rule.key];

  if (value === undefined || value === null || value === "") {
    return buildError(rule, rule.message ?? requiredMessage(rule.key));
  }

  if (rule.type === "string" && typeof value !== "string") {
    return buildError(rule, typeMessage(rule.key, rule.type));
  }

  return null;
}

export function apiValidate(body: ApiRequest, rules: AttributeRule[]): void {
  const safeBody = body as { data?: { attributes?: Record<string, unknown> } };
  const attributes = safeBody.data?.attributes ?? {};
  const errors = rules
    .map((rule) => validateRule(attributes, rule))
    .filter((error): error is ApiErrorObject => error !== null);

  if (errors.length === 0) {
    return;
  }

  throw new ApiError(errors, 422);
}
