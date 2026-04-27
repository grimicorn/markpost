import { getStore } from "@netlify/blobs";

export const getDb = () => {
  return getStore("db");
};
