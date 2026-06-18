export type ApiError = {
  status: string;
  title: string;
  detail: string;
  source?: { pointer?: string; parameter?: string };
};

export type ApiRequest = {
  data: {
    attributes: object;
  };
};

export type ApiResourceObject = {
  type: string;
  id: string;
  attributes: object;
  links?: { self: string };
};

type ApiResponseBase = {
  meta?: Record<string, unknown>;
  links?: Record<string, string | null>;
};

export type ApiResponse<T = ApiResourceObject | ApiResourceObject[] | null> =
  | (ApiResponseBase & { data: T; errors?: never })
  | (ApiResponseBase & { errors: ApiError[]; data?: never });
