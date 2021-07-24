import { Schema, model, Document } from "mongoose";
import { VrplPlayer } from "./vrplPlayer";

export enum VrplTeamPlayerRole {
  "Captain",
  "Co-Captain",
  "Player",
  "Sub",
  "Pending",

  "None",
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
    id: { type: String, required: true, unique: true },
    name: String,
    teamPlayers: { type: [Object], required: true },
    tournamentId: String,
  },
  { collection: "teams" }
);

const TeamModel = model<VrplTeam & Document>("teams", TeamSchema);
export { TeamModel as default };
