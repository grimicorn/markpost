import { ApiError } from "@libs/errors";
import type { ApiRequest } from "@t/api.types";
import titleize from "titleize";

type Attribute = { key: string; message?: string };

export const apiValidate = (body: ApiRequest, attributes: Attribute[]) => {
  const errors: Attribute[] = [];

  attributes.forEach((attribute) => {
    if (!body.data.attributes[attribute.key as keyof object]) {
      errors.push(attribute);
    }
  });

  if (errors.length === 0) {
    return;
  }

  throw new ApiError(
    errors.map(({ key, message }) => ({
      status: "422",
      source: { pointer: `/data/attributes/${key}` },
      title: "Invalid Attribute",
      detail: message ?? `${titleize(key)} is required`,
    })),
    422,
  );
};
