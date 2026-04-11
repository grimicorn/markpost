import type { ApiRequest } from "@t/api.types";

export type Record = {
  title: string;
  content: string;
};

export interface RecordRequest extends ApiRequest {
  data: {
    attributes: Record;
  };
}
