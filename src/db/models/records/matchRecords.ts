import { baseRecord, record, recordType } from ".";
import { VrplMatch } from "../vrplMatch";

export function isRecordMatchRecord(record: record): record is matchRecords {
  switch (record.type) {
    case recordType.matchCreate:
      return true;
    case recordType.matchSubmit:
      return true;
    case recordType.matchComplete:
      return true;
    case recordType.matchForfeit:
      return true;
    case recordType.matchConfirm:
      return true;
    default:
      return false;
  }
}

interface baseMatchRecord extends baseRecord {
  tournamentId: string;
  tournamentName?: string;
  matchId: string;
}

export interface matchSubmitRecord extends baseMatchRecord {
  v: 1;
  type: recordType.matchSubmit;
  teamId: string;
  teamSeed: number;
  scores: number[][];
}

export interface matchConfirmRecord extends baseMatchRecord {
  v: 1;
  type: recordType.matchConfirm;
  teamId: string;
  teamSeed: number;
  scores: number[][];
}

export interface matchCompleteRecord extends baseMatchRecord {
  v: 1;
  type: recordType.matchComplete;

  teamId: string;
  teamSeed: number;
  scores: number[][];
  winnerId?: string;
  tiedIds?: string[];
  loserIds?: string[];
}

export interface matchForfeitRecord extends baseMatchRecord {
  v: 1;
  type: recordType.matchForfeit;
  teamId: string;
  teamSeed: number;
}

export interface matchCreateRecord extends baseMatchRecord {
  v: 1;
  type: recordType.matchCreate;
  match: VrplMatch;
}

export type matchRecords =
  | matchConfirmRecord
  | matchSubmitRecord
  | matchCompleteRecord
  | matchForfeitRecord
  | matchCreateRecord;
