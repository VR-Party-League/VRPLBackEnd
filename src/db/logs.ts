import dbRecord, { baseRecord } from "./models/records";

export async function storeRecord<T extends baseRecord>(record: T) {
  const dbEntry = new dbRecord(record);
  dbEntry.save();
}
export async function storeRecords<T extends baseRecord>(records: T[]) {
  await dbRecord.insertMany(records);
}
