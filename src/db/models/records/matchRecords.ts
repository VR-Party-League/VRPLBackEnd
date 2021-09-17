import { baseRecord, recordType } from ".";
import { VrplMatch } from "../vrplMatch";

export interface matchSubmitRecord extends baseRecord {
  v: 1;
  type: recordType.matchSubmit;
  tournamentId: string;
  teamId: string;
  matchId: string;
  scores: number[][];
}

export interface matchConfirmRecord extends baseRecord {
  v: 1;
  type: recordType.matchConfirm;
  tournamentId: string;
  teamId: string;
  matchId: string;
  scores: number[][];
}
export interface matchCompleteRecord extends baseRecord {
  v: 1;
  type: recordType.matchComplete;
  tournamentId: string;
  teamId: string;
  matchId: string;
  scores: number[][];
  winnerId?: string;
  tiedIds?: string[];
  loserIds?: string[];
}
export interface matchForfeitRecord extends baseRecord {
  v: 1;
  type: recordType.matchForfeit;
  tournamentId: string;
  teamId: string;
  matchId: string;
}
export interface matchCreateRecord extends baseRecord {
  v: 1;
  type: recordType.matchCreate;
  tournamentId: string;
  matchId: string;
  match: VrplMatch;
}

export type matchRecords =
  | matchConfirmRecord
  | matchSubmitRecord
  | matchForfeitRecord
  | matchCreateRecord;
