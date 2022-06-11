import { baseRecord, record, recordType } from ".";
import { VrplTeam, VrplTeamPlayer, VrplTeamPlayerRole } from "../vrplTeam";

export function isRecordTeamRecord(record: record): record is teamRecords {
  switch (record.type) {
    case recordType.teamCreate:
      return true;
    case recordType.teamUpdate:
      return true;
    case recordType.teamDelete:
      return true;
    case recordType.teamPlayerCreate:
      return true;
    case recordType.teamPlayerUpdate:
      return true;
    case recordType.teamPlayerRemove:
      return true;
    default:
      return false;
  }
}

interface baseTeamRecord extends baseRecord {
  tournamentId: string;
  teamId: string;
  tournamentSlug?: string;
  team: VrplTeam;
}

export interface teamCreateRecord extends baseTeamRecord {
  v: 1;
  type: recordType.teamCreate;
}

export interface teamDeleteRecord extends baseTeamRecord {
  v: 1;
  type: recordType.teamDelete;
}

export interface teamUpdateRecord extends baseTeamRecord {
  v: 1;
  type: recordType.teamUpdate;
  valueChanged: keyof VrplTeam;
  old: any;
  new: any;
}

// Team player records

export interface teamPlayerCreateRecord extends baseTeamRecord {
  v: 1;
  type: recordType.teamPlayerCreate;
  playerId: string;
  role: VrplTeamPlayerRole;
}

export interface teamPlayerUpdateRecord extends baseTeamRecord {
  v: 1;
  type: recordType.teamPlayerUpdate;
  playerId: string;
  valueChanged: keyof VrplTeamPlayer;
  old: any;
  new: any;
}

export interface teamPlayerRemoveRecord extends baseTeamRecord {
  v: 1;
  type: recordType.teamPlayerRemove;
  playerId: string;
}

export type teamRecords =
  | teamCreateRecord
  | teamUpdateRecord
  | teamDeleteRecord
  | teamPlayerCreateRecord
  | teamPlayerUpdateRecord
  | teamPlayerRemoveRecord;
