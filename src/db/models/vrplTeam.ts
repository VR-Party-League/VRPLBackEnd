import { Schema, model, Document } from "mongoose";
import { VrplPlayer } from "./vrplPlayer";

export enum VrplTeamPlayerRole {
  "Captain" = 0,
  "Co-Captain" = 1,
  "Player" = 2,
  "Sub" = 3,
  "Pending" = 4,

  "None" = 5,
}

export interface VrplTeamPlayer {
  playerId: string;
  role: VrplTeamPlayerRole;
  since: Date;
}

export interface VrplTeam {
  ownerId: string;
  id: string;
  name: string;
  teamPlayers: VrplTeamPlayer[];
  tournamentId: string;
}

const TeamSchema = new Schema<VrplTeam & Document>(
  {
    ownerId: String,
    id: { type: String, required: true },
    name: String,
    teamPlayers: { type: [Object], required: true },
    tournamentId: String,
  },
  { collection: "teams" }
);

const TeamModel = model<VrplTeam & Document>("teams", TeamSchema);
export { TeamModel as default };
