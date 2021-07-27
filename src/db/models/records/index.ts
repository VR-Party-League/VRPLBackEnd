import { Schema, model, Document } from "mongoose";
import { VrplTeam } from "../vrplTeam";
import { apiTokenCreateRecord } from "./authentication";
import { matchRecords } from "./matchRecords";
import { playerRecords } from "./playerRecords";
import { teamRecords } from "./teamRecordTypes";

export enum recordType {
  apiTokenCreate = 0,
  apiTokenDelete = 1,

  playerCreate = 10, // WORKS
  playerUpdate = 11, // WORKS
  playerDelete = 12,

  matchSubmit = 20,
  matchConfirm = 21,

  teamCreate = 30, // WORKS
  teamUpdate = 31, // WORKS
  teamDelete = 32,
  teamPlayerCreate = 33, // WORKS
  teamPlayerUpdate = 34,
}

export interface baseRecord {
  v: number;
  id: string;
  type: recordType;
  userId: string;
  timestamp: Date;
}

export type record =
  | teamRecords
  | playerRecords
  | matchRecords
  | apiTokenCreateRecord;

const logSchema = new Schema<record & Document>(
  {
    v: { type: Number, required: true },
    id: { type: String, required: true, unique: true },
    type: { type: Number, required: true },
    userId: { type: String, required: true },
    timestamp: { type: Date, required: true },
  },
  { collection: "logs", strict: false }
);

const LogModel = model<record & Document>("logs", logSchema);
export { LogModel as default };
