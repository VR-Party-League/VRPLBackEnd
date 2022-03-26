import { Document, model, Schema } from "mongoose";

export enum VrplTeamPlayerRole {
  Captain = 0,
  "Co-Captain" = 1,
  Player = 2,
  Sub = 3,
  Pending = 4,
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

  socials: {
    discord?: string;
    twitter?: string;
    youtube?: string;
    // instagram?: string;
    twitch?: string;
    // facebook?: string;
  };
}

export const supportedSocialPlatforms = [
  "discord",
  "twitter",
  "youtube",
  // "instagram",
  "twitch",
  // "facebook",
];

export type SocialPlatform = keyof VrplTeam["socials"];
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
    socials: {
      type: {
        discord: String,
        twitter: String,
        youtube: String,
        // instagram?: String,
        twitch: String,
        // facebook?: String,
      },
      required: true,
      default: {},
    },
  },
  { collection: "teams" }
);

const TeamModel = model<VrplTeam & Document>("teams", TeamSchema);
export { TeamModel as default };
