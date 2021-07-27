import { baseRecord, recordType } from ".";

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

export interface matchForfeitRecord extends baseRecord {
  v: 1;
  type: recordType.matchForfeit;
  tournamentId: string;
  teamId: string;
  matchId: string;
}

export type matchRecords =
  | matchConfirmRecord
  | matchSubmitRecord
  | matchForfeitRecord;
