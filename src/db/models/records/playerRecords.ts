import { baseRecord, recordType } from ".";
import { VrplPlayer } from "../vrplPlayer";

export interface playerCreateRecord extends baseRecord {
  v: 1;
  type: recordType.playerCreate;
  playerId: string;
  player: VrplPlayer;
}

export interface playerUpdateRecord extends baseRecord {
  v: 1;
  type: recordType.playerUpdate;
  playerId: string;
  valueChanged: keyof VrplPlayer | "avatar";
  old: any;
  new: any;
}

export interface playerDeleteRecord extends baseRecord {
  v: 1;
  type: recordType.playerDelete;
  playerId: string;
  player: VrplPlayer;
}

export type playerRecords =
  | playerCreateRecord
  | playerUpdateRecord
  | playerDeleteRecord;
