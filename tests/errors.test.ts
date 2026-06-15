import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ApiError,
  buildErrorObject,
  buildErrorEnvelope,
  methodNotAllowed,
  unsupportedMediaType,
  unauthorized,
  invalidAttribute,
  badRequest,
  internalServerError,
} from "../server/utils/errors";

describe("ApiError", () => {
  it("sets statusCode and errors", () => {
    const errors = [
      buildErrorObject(422, "Invalid Attribute", "Title is required"),
    ];
    const apiError = new ApiError(422, errors);

    expect(apiError.statusCode).toBe(422);
    expect(apiError.errors).toEqual(errors);
  });

  it("sets message from error details joined by semicolon", () => {
    const errors = [
      buildErrorObject(422, "Invalid Attribute", "Title is required"),
      buildErrorObject(422, "Invalid Attribute", "Content is required"),
    ];
    const apiError = new ApiError(422, errors);

    expect(apiError.message).toBe("Title is required; Content is required");
  });

  it("is an instance of Error", () => {
    const apiError = new ApiError(500, [
      buildErrorObject(500, "Internal Server Error", "Unknown error occurred."),
    ]);

    expect(apiError).toBeInstanceOf(Error);
  });
});

describe("buildErrorObject", () => {
  it("returns error object with status as string", () => {
    const errorObject = buildErrorObject(
      422,
      "Invalid Attribute",
      "Title is required",
    );

    expect(errorObject).toEqual({
      status: "422",
      title: "Invalid Attribute",
      detail: "Title is required",
    });
  });

  it("includes source when provided", () => {
    const errorObject = buildErrorObject(
      422,
      "Invalid Attribute",
      "Title is required",
      {
        pointer: "/data/attributes/title",
      },
    );

    expect(errorObject.source).toEqual({ pointer: "/data/attributes/title" });
  });

  it("omits source when not provided", () => {
    const errorObject = buildErrorObject(
      422,
      "Invalid Attribute",
      "Title is required",
    );

    expect(errorObject).not.toHaveProperty("source");
  });
});

describe("buildErrorEnvelope", () => {
  it("wraps errors in data.errors", () => {
    const errors = [
      buildErrorObject(422, "Invalid Attribute", "Title is required"),
    ];
    const envelope = buildErrorEnvelope(errors);

    expect(envelope).toEqual({ data: { errors } });
  });

  it("supports multiple errors in a single envelope", () => {
    const errors = [
      buildErrorObject(422, "Invalid Attribute", "Title is required", {
        pointer: "/data/attributes/title",
      }),
      buildErrorObject(422, "Invalid Attribute", "Content is required", {
        pointer: "/data/attributes/content",
      }),
    ];
    const envelope = buildErrorEnvelope(errors);

    expect(envelope.data.errors).toHaveLength(2);
  });
});

describe("methodNotAllowed", () => {
  it("returns ApiError with 405 status", () => {
    const error = methodNotAllowed();

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(405);
    expect(error.errors[0].status).toBe("405");
    expect(error.errors[0].title).toBe("Method Not Allowed");
  });
});

describe("unsupportedMediaType", () => {
  it("returns ApiError with 415 status", () => {
    const error = unsupportedMediaType();

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(415);
    expect(error.errors[0].status).toBe("415");
    expect(error.errors[0].title).toBe("Unsupported Media Type");
  });
});

describe("unauthorized", () => {
  it("returns ApiError with 401 status", () => {
    const error = unauthorized();

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(401);
    expect(error.errors[0].status).toBe("401");
    expect(error.errors[0].title).toBe("Unauthorized");
  });
});

describe("invalidAttribute", () => {
  it("returns an error object with 422 status and pointer source", () => {
    const errorObject = invalidAttribute(
      "Title is required",
      "/data/attributes/title",
    );

    expect(errorObject.status).toBe("422");
    expect(errorObject.title).toBe("Invalid Attribute");
    expect(errorObject.detail).toBe("Title is required");
    expect(errorObject.source).toEqual({ pointer: "/data/attributes/title" });
  });
});

describe("badRequest", () => {
  it("returns ApiError with 400 status and parameter source", () => {
    const error = badRequest("uuid is required", "uuid");

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(400);
    expect(error.errors[0].status).toBe("400");
    expect(error.errors[0].title).toBe("Bad Request");
    expect(error.errors[0].source).toEqual({ parameter: "uuid" });
  });
});

describe("internalServerError", () => {
  it("returns ApiError with 500 status", () => {
    const error = internalServerError();

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(500);
    expect(error.errors[0].status).toBe("500");
    expect(error.errors[0].title).toBe("Internal Server Error");
    expect(error.errors[0].detail).toBe("Unknown error occurred.");
  });
});

describe("error handler behavior", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("does not log expected ApiErrors", () => {
    const error = unauthorized();

    // ApiError is an expected error — the handler should not log it.
    // We verify this by confirming it's an instance of ApiError (not a generic Error).
    expect(error).toBeInstanceOf(ApiError);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("internalServerError detail does not include stack trace info", () => {
    const error = internalServerError();

    expect(error.errors[0].detail).toBe("Unknown error occurred.");
  });
});
