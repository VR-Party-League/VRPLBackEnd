import { baseRecord, recordType } from ".";
import { VrplTeam, VrplTeamPlayer, VrplTeamPlayerRole } from "../vrplTeam";

export interface teamCreateRecord extends baseRecord {
  v: 1;
  type: recordType.teamCreate;
  tournamentId: string;
  teamId: string;
  team: VrplTeam;
}

export interface teamDeleteRecord extends baseRecord {
  v: 1;
  type: recordType.teamDelete;
  tournamentId: string;
  teamId: string;
  team: VrplTeam;
}

export interface teamUpdateRecord extends baseRecord {
  v: 1;
  type: recordType.teamUpdate;
  tournamentId: string;
  teamId: string;
  valueChanged: keyof VrplTeam;
  old: any;
  new: any;
}

// Team player records

export interface teamPlayerCreateRecord extends baseRecord {
  v: 1;
  type: recordType.teamPlayerCreate;
  tournamentId: string;
  teamId: string;
  playerId: string;
  role: VrplTeamPlayerRole;
}

export interface teamPlayerUpdateRecord extends baseRecord {
  v: 1;
  type: recordType.teamPlayerUpdate;
  tournamentId: string;
  teamId: string;
  playerId: string;
  valueChanged: keyof VrplTeamPlayer;
  old: any;
  new: any;
}

export type teamRecords =
  | teamCreateRecord
  | teamUpdateRecord
  | teamDeleteRecord
  | teamPlayerCreateRecord
  | teamPlayerUpdateRecord;
