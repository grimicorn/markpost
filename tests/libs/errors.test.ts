import { describe, it, expect, vi } from "vitest";
import { ApiError, apiErrorHandler } from "@libs/errors";

type ErrorBody = {
  data: {
    errors: { status: string; title: string; detail: string }[];
  };
};

const makeApiError = (status = 400) =>
  new ApiError(
    [
      {
        status: String(status),
        title: "Bad Request",
        detail: "Something went wrong.",
      },
    ],
    status,
  );

describe("ApiError", () => {
  it("is an instance of Error", () => {
    expect(makeApiError()).toBeInstanceOf(Error);
  });

  it("is an instance of ApiError", () => {
    expect(makeApiError()).toBeInstanceOf(ApiError);
  });

  it("exposes a response with the given status", () => {
    expect(makeApiError(422).response.status).toBe(422);
  });

  it("response Content-Type is application/vnd.api+json", () => {
    expect(makeApiError().response.headers.get("Content-Type")).toBe(
      "application/vnd.api+json",
    );
  });

  it("response body contains the provided error shape", async () => {
    const error = makeApiError(400);
    const body = (await error.response.json()) as ErrorBody;
    expect(body.data.errors[0]?.status).toBe("400");
    expect(body.data.errors[0]?.title).toBe("Bad Request");
  });
});

describe("apiErrorHandler", () => {
  it("returns the ApiError response when given an ApiError", async () => {
    const error = makeApiError(404);
    const response = apiErrorHandler(error);
    expect(response.status).toBe(404);
    const body = (await response.json()) as ErrorBody;
    expect(body.data.errors[0]?.title).toBe("Bad Request");
  });

  it("returns a 500 response for unknown errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = apiErrorHandler(new Error("boom"));
    expect(response.status).toBe(500);
    const body = (await response.json()) as ErrorBody;
    expect(body.data.errors[0]?.status).toBe("500");
    expect(body.data.errors[0]?.title).toBe("Internal Server Error");
    consoleSpy.mockRestore();
  });

  it("logs unknown errors to console.error", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");
    apiErrorHandler(err);
    expect(consoleSpy).toHaveBeenCalledWith(err);
    consoleSpy.mockRestore();
  });
});
