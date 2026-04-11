import { getDb } from "@libs/db";
import type { Config } from "@netlify/functions";
import { apiCheckAuth } from "@libs/auth";
import { apiErrorHandler } from "@libs/errors";
import { apiResponse } from "@libs/response";
import { apiValidateRequest } from "@libs/request";
import { standardizeRecordResponse } from "@libs/records";
import type { Record } from "@t/record.types";

const DEFAULT_PAGE_SIZE = 100;

export default async (request: Request) => {
  try {
    apiValidateRequest(request, "GET", false);
    apiCheckAuth(request);

    const url = new URL(request.url);
    const pageNumber = parseInt(
      url.searchParams.get("page[number]") ?? "1",
      10,
    );
    const pageSize = parseInt(
      url.searchParams.get("page[size]") ?? String(DEFAULT_PAGE_SIZE),
      10,
    );

    const db = getDb();
    const { blobs } = await db.list();
    const total = blobs.length;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const offset = (pageNumber - 1) * pageSize;
    const pageBlobs = blobs.slice(offset, offset + pageSize);

    const records = await Promise.all(
      pageBlobs.map(async ({ key }) => {
        const raw = await db.get(key, { type: "text" });
        return JSON.parse(raw as string) as Record;
      }),
    );

    const buildLink = (page: number) => {
      return `/api/records?page[number]=${page}&page[size]=${pageSize}`;
    };

    return apiResponse(
      {
        data: records.map(standardizeRecordResponse),
        meta: {
          total,
          pageCount: totalPages,
          size: pageSize,
          page: pageNumber,
        },
        links: {
          first: buildLink(1),
          last: buildLink(totalPages),
          prev: pageNumber > 1 ? buildLink(pageNumber - 1) : null,
          next: pageNumber < totalPages ? buildLink(pageNumber + 1) : null,
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
  method: "GET",
};
