import type { ApiRequest } from "@t/api.types";

export type Record = {
  uuid: string;
  createdAt: string;
  title: string;
  content: string;
};

export interface RecordRequest extends ApiRequest {
  data: {
    attributes: Record;
  };
}
