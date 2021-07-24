import { Schema, model, Document } from "mongoose";
import { VrplTeam } from "../vrplTeam";
import { playerRecords } from "./playerRecords";
import { teamRecords } from "./teamRecordTypes";

export enum recordType {
  teamCreate = 0,
  teamUpdate = 1,
  teamDelete = 2,
  teamPlayerCreate = 3,
  teamPlayerUpdate = 4,

  playerCreate = 10,
  playerUpdate = 11,
  playerDelete = 12,
}

export interface baseRecord {
  v: number;
  id: string;
  type: recordType;
  userId: string;
  timestamp: Date;
}

export type record = teamRecords | playerRecords;

const logSchema = new Schema<record & Document>(
  {
    v: { type: Number, required: true },
    id: { type: String, required: true, unique: true },
    type: { type: Number, required: true },
    userId: { type: String, required: true, unique: true },
    timestamp: { type: Date, required: true },
  },
  { collection: "logs", strict: false }
);

const LogModel = model<record & Document>("logs", logSchema);
export { LogModel as default };
