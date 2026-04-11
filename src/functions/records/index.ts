import { getDb } from "@libs/db.js";
import type { Config, Context } from "@netlify/functions";
import { v4 as uuidv4 } from "uuid";
import type { RecordRequest } from "@types/record.types";
import { apiCheckAuth } from "@libs/auth.js";
import { apiErrorHandler } from "@libs/errors.js";
import { apiValidate } from "@libs/validator.js";
import { apiResponse } from "@libs/response.js";
import { apiValidateRequest } from "@libs/request.js";

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
    const response = await getDb().setJSON(record.uuid, record);

    return apiResponse(
      {
        data: { ...response, ...record },
        links: {
          self: `${context.site.url}/api/records/${record.uuid}`,
        },
      },
      201,
    );
  } catch (error) {
    return apiErrorHandler(error as Error);
  }
};

export const config: Config = {
  path: "/api/records",
};
