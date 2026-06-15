import { defineNitroErrorHandler } from "nitropack/runtime";
import {
  isError as isH3Error,
  send,
  setResponseHeader,
  setResponseStatus,
} from "h3";
import {
  ApiError,
  buildErrorEnvelope,
  internalServerError,
} from "./utils/errors";

export default defineNitroErrorHandler((error, event) => {
  if (error instanceof ApiError) {
    return sendApiErrorResponse(event, error);
  }

  if (isH3Error(error)) {
    return sendH3ErrorResponse(event, error);
  }

  console.error("[unhandled error]", error);
  return sendApiErrorResponse(event, internalServerError());
});

function sendApiErrorResponse(
  event: Parameters<typeof send>[0],
  apiError: ApiError,
) {
  setResponseStatus(event, apiError.statusCode);
  setResponseHeader(event, "Content-Type", "application/json");
  return send(event, JSON.stringify(buildErrorEnvelope(apiError.errors)));
}

function sendH3ErrorResponse(
  event: Parameters<typeof send>[0],
  h3Error: { statusCode: number; statusMessage: string },
) {
  const { statusCode, statusMessage } = h3Error;
  const apiError = new ApiError(statusCode, [
    {
      status: String(statusCode),
      title: statusMessage,
      detail: statusMessage,
    },
  ]);
  setResponseStatus(event, statusCode);
  setResponseHeader(event, "Content-Type", "application/json");
  return send(event, JSON.stringify(buildErrorEnvelope(apiError.errors)));
}
