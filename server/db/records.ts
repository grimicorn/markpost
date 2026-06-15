import { eq } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { records } from "./schema";
import { getDb } from "./index";

export type Record = InferSelectModel<typeof records>;
export type NewRecord = Pick<
  InferInsertModel<typeof records>,
  "title" | "content"
>;

export function findRecord(recordUuid: string): Promise<Record | undefined> {
  const db = getDb();
  return db.query.records.findFirst({
    where: eq(records.uuid, recordUuid),
  });
}

export function listRecords(): Promise<Record[]> {
  const db = getDb();
  return db.query.records.findMany();
}

export function createRecord(input: NewRecord): Promise<Record> {
  const db = getDb();
  return db
    .insert(records)
    .values(input)
    .returning()
    .then(([record]) => record);
}

export function deleteRecord(recordUuid: string): Promise<Record | undefined> {
  const db = getDb();
  return db
    .delete(records)
    .where(eq(records.uuid, recordUuid))
    .returning()
    .then(([record]) => record);
}
