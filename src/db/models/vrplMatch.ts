import { Document, model, Schema } from "mongoose";

export type VrplMatch =
  | PlainVrplMatch
  | SubmittedVrplMatch
  | CompletedVrplMatch;

export interface PlainVrplMatch {
  id: string;
  tournamentId: string;
  teamSeeds: number[];
  handicaps?: number[];
  timeStart: Date;
  timeDeadline: Date;
}

export interface SubmittedVrplMatch extends PlainVrplMatch {
  seedsConfirmed: number[];
  submitterSeed: number;
  /**
   * An array of rounds, which contain scores of teams
   */
  scores: number[][];
  timeSubmitted: Date;
  isForfeit: boolean;

  winnerId?: string;
  tiedIds: string[];
  loserIds: string[];
}

export interface CompletedVrplMatch extends SubmittedVrplMatch {
  timeConfirmed: Date;
}

// make function to check if the type of the match is submitted
export function isSubmitted(match: VrplMatch): match is SubmittedVrplMatch {
  // Check if teamIdsConfirmed isnt undefined or null
  const subMatch = match as SubmittedVrplMatch;
  return (
    subMatch.timeSubmitted !== undefined && subMatch.timeSubmitted !== null
  );
}

// make function to check if the type of the match is completed
export function isCompleted(match: VrplMatch): match is CompletedVrplMatch {
  const compMatch = match as CompletedVrplMatch;
  return (
    compMatch.timeConfirmed !== undefined && compMatch.timeConfirmed !== null
  );
}

const MatchSchema = new Schema<VrplMatch & Document>(
  {
    id: { type: String, required: true, unique: true },
    tournamentId: String,
    teamSeeds: [Number],
    handicaps: { type: [Number], required: false },
    timeStart: Date,
    timeDeadline: Date,
    seedsConfirmed: { type: [Number], required: false },
    submitterSeed: { type: Number, required: false },

    /**
     * An array of rounds, which contain scores of teams
     */
    scores: { type: [[Number]], required: false },
    timeSubmitted: { type: Date, required: false },
    isForfeit: { type: Boolean, required: false },
    winnerId: { type: String, required: false },
    tiedIds: { type: [String], required: false },
    loserIds: { type: [String], required: false },
    timeConfirmed: { type: Date, required: false },
  },
  { collection: "matches" }
);

const MatchModel = model<VrplMatch & Document>("matches", MatchSchema);
export { MatchModel as default };
