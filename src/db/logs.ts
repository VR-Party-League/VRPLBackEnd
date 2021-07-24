import records, { baseRecord } from "./models/records";

export async function storeRecord<T extends baseRecord>(record: T) {
  const dbEntry = new records(record);
  dbEntry.save();
}
