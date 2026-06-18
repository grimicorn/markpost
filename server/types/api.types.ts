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

export type ApiResponse<T = ApiResourceObject | ApiResourceObject[] | null> = {
  data?: T;
  meta?: Record<string, unknown>;
  links?: Record<string, string | null>;
  errors?: ApiError[];
};
