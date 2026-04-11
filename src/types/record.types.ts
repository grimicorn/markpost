import type { ApiRequest } from "@types/api.types.js";

export type Record = {
  title: string;
  content: string;
};

export interface RecordRequest extends ApiRequest {
  data: {
    attributes: Record;
  };
}
