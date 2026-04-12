export type ApiError = {
  status: string;
  title: string;
  detail: string;
  source?: object;
};

export type ApiRequest = {
  data: {
    attributes: object;
  };
};
