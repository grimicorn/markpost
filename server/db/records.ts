import { eq } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { records } from "./schema";
import { getDb } from "./index";

type DbRecord = InferSelectModel<typeof records>;

export type Record = Omit<DbRecord, "createdAt"> & { createdAt: string };
export type NewRecord = Pick<
  InferInsertModel<typeof records>,
  "title" | "content"
>;

function toRecord(dbRecord: DbRecord): Record {
  return { ...dbRecord, createdAt: dbRecord.createdAt.toISOString() };
}

function validateNewRecord(input: NewRecord): NewRecord {
  const title = input.title.trim();
  const content = input.content.trim();

  if (!title) {
    throw new Error("title must not be empty");
  }

  if (!content) {
    throw new Error("content must not be empty");
  }

  return { title, content };
}

export async function findRecord(
  recordUuid: string,
): Promise<Record | undefined> {
  const db = getDb();
  const dbRecord = await db.query.records.findFirst({
    where: eq(records.uuid, recordUuid),
  });

  if (!dbRecord) {
    return undefined;
  }

  return toRecord(dbRecord);
}

export async function listRecords(): Promise<Record[]> {
  const db = getDb();
  const dbRecords = await db.query.records.findMany();
  return dbRecords.map(toRecord);
}

export async function createRecord(input: NewRecord): Promise<Record> {
  const db = getDb();
  const validated = validateNewRecord(input);
  const [dbRecord] = await db.insert(records).values(validated).returning();
  return toRecord(dbRecord);
}

export async function deleteRecord(
  recordUuid: string,
): Promise<Record | undefined> {
  const db = getDb();
  const [dbRecord] = await db
    .delete(records)
    .where(eq(records.uuid, recordUuid))
    .returning();

  if (!dbRecord) {
    return undefined;
  }

  return toRecord(dbRecord);
}
