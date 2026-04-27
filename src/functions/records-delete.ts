import { getDb } from "@libs/db";
import type { Config } from "@netlify/functions";
import { apiCheckAuth } from "@libs/auth";
import { apiErrorHandler } from "@libs/errors";
import { apiValidate } from "@libs/validator";
import { apiResponse } from "@libs/response";
import { apiValidateRequest } from "@libs/request";

type DeleteRequest = {
  data: {
    attributes: {
      uuids: string[];
    };
  };
};

export default async (request: Request) => {
  try {
    apiValidateRequest(request, "DELETE");
    apiCheckAuth(request);

    const body = (await request.json()) as DeleteRequest;
    apiValidate(body, [{ key: "uuids" }]);

    const { uuids } = body.data.attributes;
    await Promise.all(uuids.map((uuid) => getDb().delete(uuid)));

    return apiResponse(
      {
        meta: {
          deleted: uuids.length,
        },
      },
      200,
    );
  } catch (error) {
    return apiErrorHandler(error as Error);
  }
};

export const config: Config = {
  path: "/api/records",
  method: "DELETE",
};
