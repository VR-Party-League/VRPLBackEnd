import { Schema, model, Document, ObjectId } from "mongoose";
import { authenticationRecords } from "./apiTokenRecords";
import { badgeRecords } from "./badgeRecords";
import { matchRecords } from "./matchRecords";
import { playerRecords } from "./playerRecords";
import { teamRecords } from "./teamRecordTypes";
import { OAuthClientRecord } from "./oauthRecords";

export enum recordType {
  apiTokenCreate = 0,
  apiTokenDelete = 1,

  playerCreate = 10, // WORKS
  playerUpdate = 11, // WORKS
  playerDelete = 12,

  matchSubmit = 20,
  matchConfirm = 21,
  matchForfeit = 22,
  matchCreate = 23,
  matchComplete = 24,

  teamCreate = 30, // WORKS
  teamUpdate = 31, // WORKS
  teamDelete = 32,
  teamPlayerCreate = 33, // WORKS
  teamPlayerUpdate = 34,
  teamPlayerRemove = 35,

  badgeCreate = 40,
  badgeUpdate = 41,
  badgeDelete = 42,

  OAuthClientCreate = 100,
  OAuthClientUpdate = 101,
  OAuthClientDelete = 102,
}

export interface baseRecord {
  v: number;
  id: string;
  type: recordType;
  performedByPlayerId?: string;
  performedByUserId: ObjectId;
  timestamp: Date;
}

export type record =
  | teamRecords
  | playerRecords
  | matchRecords
  | authenticationRecords
  | badgeRecords
  | OAuthClientRecord;

const logSchema = new Schema<record & Document>(
  {
    v: { type: Number, required: true },
    id: { type: String, required: true },
    type: { type: Number, required: true },
    performedByPlayerId: { type: String, required: true },
    performedByUserId: { type: Schema.Types.ObjectId, required: true },
    timestamp: { type: Date, required: true },
  },
  { collection: "logs", strict: false }
);

const LogModel = model<record & Document>("logs", logSchema);
export { LogModel as default };
