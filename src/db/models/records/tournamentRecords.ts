import { baseRecord, recordType } from ".";
import { VrplTournament } from "../vrplTournaments";

export interface tournamentCreateRecord extends baseRecord {
  v: 1;
  type: recordType.tournamentCreate;
  tournamentId: string;
  tournamentSlug: string;
  tournament: VrplTournament;
}

export interface tournamentUpdateRecord extends baseRecord {
  v: 1;
  type: recordType.tournamentUpdate;
  tournamentId: string;
  tournamentSlug: string;
  valueChanged: keyof VrplTournament;
  old: any;
  new: any;
}

export interface tournamentDeleteRecord extends baseRecord {
  v: 1;
  type: recordType.tournamentDelete;
  tournamentId: string;
  tournamentSlug: string;
  tournament: VrplTournament;
}

export type tournamentRecords =
  | tournamentCreateRecord
  | tournamentUpdateRecord
  | tournamentDeleteRecord;
