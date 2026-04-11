import { getDb } from "@libs/db";
import type { Config, Context } from "@netlify/functions";
import { v4 as uuidv4 } from "uuid";
import type { RecordRequest } from "@t/record.types";
import { apiCheckAuth } from "@libs/auth";
import { apiErrorHandler } from "@libs/errors";
import { apiValidate } from "@libs/validator";
import { apiResponse } from "@libs/response";
import { apiValidateRequest } from "@libs/request";

export default async (request: Request, context: Context) => {
  try {
    apiValidateRequest(request, "POST");
    apiCheckAuth(request);

    const body = (await request.json()) as RecordRequest;
    apiValidate(body, [{ key: "title" }, { key: "content" }]);

    const record = {
      uuid: uuidv4(),
      createdAt: new Date().toISOString(),
      ...body.data.attributes,
    };

    await getDb().setJSON(record.uuid, record);

    // @todo Standardize/Type the response data?
    return apiResponse(
      {
        data: {
          type: "records",
          id: record.uuid,
          attributes: {
            ...record,
          },
          links: {
            self: `${context.site.url}/api/records/${record.uuid}`,
          },
        },
      },
      201,
    );
  } catch (error) {
    return apiErrorHandler(error as Error);
  }
};

export const config: Config = {
  path: "/api/records/create",
};
