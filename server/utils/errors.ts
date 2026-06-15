export interface ErrorSource {
  pointer?: string;
  parameter?: string;
}

export interface ErrorObject {
  status: string;
  title: string;
  detail: string;
  source?: ErrorSource;
}

export interface ErrorEnvelope {
  data: {
    errors: ErrorObject[];
  };
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly errors: ErrorObject[];

  constructor(statusCode: number, errors: ErrorObject[]) {
    super(errors.map((error) => error.detail).join("; "));
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export function buildErrorObject(
  statusCode: number,
  title: string,
  detail: string,
  source?: ErrorSource,
): ErrorObject {
  const errorObject: ErrorObject = {
    status: String(statusCode),
    title,
    detail,
  };

  if (source) {
    errorObject.source = source;
  }

  return errorObject;
}

export function buildErrorEnvelope(errors: ErrorObject[]): ErrorEnvelope {
  return { data: { errors } };
}

export function methodNotAllowed(): ApiError {
  return new ApiError(405, [
    buildErrorObject(405, "Method Not Allowed", "Method not allowed."),
  ]);
}

export function unsupportedMediaType(): ApiError {
  return new ApiError(415, [
    buildErrorObject(
      415,
      "Unsupported Media Type",
      "Content-Type must be application/json.",
    ),
  ]);
}

export function unauthorized(): ApiError {
  return new ApiError(401, [
    buildErrorObject(401, "Unauthorized", "Missing or invalid auth token."),
  ]);
}

export function invalidAttribute(detail: string, pointer: string): ErrorObject {
  return buildErrorObject(422, "Invalid Attribute", detail, { pointer });
}

export function badRequest(detail: string, parameter: string): ApiError {
  return new ApiError(400, [
    buildErrorObject(400, "Bad Request", detail, { parameter }),
  ]);
}

export function internalServerError(): ApiError {
  return new ApiError(500, [
    buildErrorObject(500, "Internal Server Error", "Unknown error occurred."),
  ]);
}
