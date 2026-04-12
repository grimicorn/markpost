import { getDb } from "@libs/db";
import type { Config, Context } from "@netlify/functions";
import { apiCheckAuth } from "@libs/auth";
import { ApiError, apiErrorHandler } from "@libs/errors";
import { apiResponse } from "@libs/response";
import { apiValidateRequest } from "@libs/request";
import { standardizeRecordResponse } from "@libs/records";

export default async (request: Request, context: Context) => {
  try {
    apiValidateRequest(request, "GET", false);
    apiCheckAuth(request);

    const { uuid } = context.params;
    if (!uuid || uuid === ":uuid") {
      throw new ApiError(
        [
          {
            status: "400",
            title: "Bad Request",
            detail: "Missing required path parameter: uuid",
            source: {
              parameter: "uuid",
            },
          },
        ],
        400,
      );
    }

    let record = null;
    try {
      record = JSON.parse(await getDb().get(uuid, { type: "text" }));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      // Left intentionally blank
    }

    return apiResponse(
      {
        data: standardizeRecordResponse(record),
      },
      200,
    );
  } catch (error) {
    return apiErrorHandler(error as Error);
  }
};

export const config: Config = {
  path: "/api/records/:uuid",
  method: "GET",
};
