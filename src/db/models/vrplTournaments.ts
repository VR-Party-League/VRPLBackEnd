import { Document, model, Schema } from "mongoose";
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

// Currently, only supports matches with 2 players
export interface VrplTournament {
  id: string;
  type: VrplTournamentType;
  name: string;
  slug: string;
  description: string;
  summary: string;
  banner: string;
  icon: string;
  rules: String;
  gameId: string;
  matchRounds: number;
  matchMaxScore: number;

  eligibilityCheck?: string;
  region?: VrplRegion;

  start: Date;
  end: Date;
  registrationStart: Date;
  registrationEnd: Date;
}

const TournamentSchema = new Schema<VrplTournament & Document>(
  {
    id: { type: String, required: true, unique: true, index: true },
    type: String,
    name: {
      type: String,
      required: true,
      unique: false,
      text: true,
      index: "text",
    },
    slug: String,
    summary: String,
    description: String,
    banner: String,
    icon: String,
    rules: String,
    gameId: String,
    matchRounds: Number,
    matchMaxScore: Number,

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
export default TournamentModel;
