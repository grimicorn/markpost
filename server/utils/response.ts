import type { ApiResourceObject, ApiResponse } from "../types/api.types";

type RecordAttributes = {
  uuid: string;
  createdAt: Date;
  userId: string;
  title: string;
  content: string;
};

type RecordInput = {
  uuid: string;
  createdAt: Date;
  userId: string;
  title: string;
  content: string;
};

type RecordResource = ApiResourceObject & {
  type: "records";
  attributes: RecordAttributes;
  links: { self: string };
};

type PaginationMetaOptions = {
  total: number;
  size: number;
  hasMore: boolean;
};

type PaginationMeta = {
  total: number;
  size: number;
  hasMore: boolean;
};

type PaginationLinksOptions = {
  afterCursor: string | null;
  prevCursor: string | null;
  size: number;
  hasMore: boolean;
};

type PaginationLinks = {
  next: string | null;
  prev: string | null;
};

export type RecordApiResponse = ApiResponse<RecordResource | null>;
export type RecordListApiResponse = ApiResponse<RecordResource[]>;

export function recordSerializer(
  record: RecordInput | null | undefined,
): RecordResource | null {
  if (!record) {
    return null;
  }

  return {
    type: "records",
    id: record.uuid,
    attributes: {
      uuid: record.uuid,
      createdAt: record.createdAt,
      userId: record.userId,
      title: record.title,
      content: record.content,
    },
    links: {
      self: `/api/records/${record.uuid}`,
    },
  };
}

export function paginationMeta(options: PaginationMetaOptions): PaginationMeta {
  return {
    total: options.total,
    size: options.size,
    hasMore: options.hasMore,
  };
}

export function paginationLinks(
  options: PaginationLinksOptions,
): PaginationLinks {
  const nextLink = buildNextLink(options);
  const prevLink = buildPrevLink(options);

  return {
    next: nextLink,
    prev: prevLink,
  };
}

function buildNextLink(options: PaginationLinksOptions): string | null {
  if (!options.hasMore || !options.afterCursor) {
    return null;
  }

  const params = new URLSearchParams({
    "page[after]": options.afterCursor,
    "page[size]": String(options.size),
  });

  return `/api/records?${params.toString()}`;
}

function buildPrevLink(options: PaginationLinksOptions): string | null {
  if (!options.prevCursor) {
    return null;
  }

  const params = new URLSearchParams({
    "page[after]": options.prevCursor,
    "page[size]": String(options.size),
  });

  return `/api/records?${params.toString()}`;
}
