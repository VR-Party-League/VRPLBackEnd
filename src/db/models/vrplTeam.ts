import { Schema, model, Document } from "mongoose";
import { VrplPlayer } from "./vrplPlayer";

export enum VrplTeamPlayerRole {
  Captain = 0,
  "Co-Captain" = 1,
  Player = 2,
  Sub = 3,
  Pending = 4,

  Left = 5,
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
  createdAt: Date;

  gp: number;
  wins: number;
  losses: number;
  ties: number;
}

// TODO: team socials

// TODO: Whats text indexing, is it useful?
const TeamSchema = new Schema<VrplTeam & Document>(
  {
    ownerId: String,
    id: { type: String, required: true },
    name: { type: String, required: true },
    teamPlayers: {
      type: [
        {
          playerId: String,
          role: Number,
          since: Date,
        },
      ],
      required: true,
    },
    tournamentId: String,
    createdAt: Date,

    gp: Number,
    wins: Number,
    losses: Number,
    ties: Number,
  },
  { collection: "teams" }
);

const TeamModel = model<VrplTeam & Document>("teams", TeamSchema);
export { TeamModel as default };
