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
export type Rules = { title: string; description?: string; body: string }[];
export interface VrplTournament {
  id: string;
  type: VrplTournamentType;
  name: string;
  description: string;
  banner: string;
  rules: Rules;
  gameId: string;
  rounds: number;
  maxScore: number;

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
    description: String,
    banner: String,
    rules: Object,
    gameId: String,
    rounds: Number,
    maxScore: Number,

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
