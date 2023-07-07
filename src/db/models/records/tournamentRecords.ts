import { baseRecord, recordType } from ".";
import { VrplTournament } from "../vrplTournaments";

export interface tournamentCreateRecord extends baseRecord {
  v: 1;
  type: recordType.tournamentCreate;
  tournamentId: string;
  tournament: VrplTournament;
}

export interface tournamentUpdateRecord extends baseRecord {
  v: 1;
  type: recordType.tournamentUpdate;
  tournamentId: string;
  tournament: VrplTournament;
}

export interface tournamentDeleteRecord extends baseRecord {
  v: 1;
  type: recordType.tournamentDelete;
  tournamentId: string;
  tournament: VrplTournament;
}

export type tournamentRecords =
  | tournamentCreateRecord
  | tournamentUpdateRecord
  | tournamentDeleteRecord;
