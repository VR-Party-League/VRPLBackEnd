import { Schema, model, Document } from "mongoose";
import { VrplMatch } from "./vrplMatch";
import { VrplPlayer } from "./vrplPlayer";

export enum VrplTournamentType {
  "RoundRobin" = "RR",
  "DoubleElimination" = "DE",
}

export enum VrplRegion {
  "EU",
  "NA",
}

const eligibilityChecks: {
  [Name: string]: (Player: VrplPlayer) => boolean | undefined | null;
} = {};
export interface VrplTournament {
  id: string;
  type: VrplTournamentType;
  name: string;
  description: string;
  summary: string;
  banner: string;
  icon: string;
  rules: String;
  gameId: string;
  matchRounds: number;
  matchMaxScore: number;

  matchIds: string[];
  currentMatchIds: string[];

  eligibilityCheck?: string;
  region?: VrplRegion;

  start: Date;
  end: Date;
  registrationStart: Date;
  registrationEnd: Date;
}

const TournamentSchema = new Schema<VrplTournament & Document>(
  {
    id: { type: String, required: true, unique: true },
    type: String,
    name: String,
    summary: String,
    description: String,
    banner: String,
    icon: String,
    rules: String,
    gameId: String,
    matchRounds: Number,
    matchMaxScore: Number,

    matchIds: [String],
    currentMatchIds: [String],

    eligibilityCheck: { type: String, required: false },
    region: { type: String, required: false },

    start: Date,
    end: Date,
    registrationStart: Date,
    registrationEnd: Date,
  },
  { collection: "tournaments" }
);

const TournamentModel = model<VrplTournament & Document>(
  "tournaments",
  TournamentSchema
);
export { TournamentModel };
