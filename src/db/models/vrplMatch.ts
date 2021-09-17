import { Schema, model, Document } from "mongoose";

export type VrplMatch =
  | PlainVrplMatch
  | SubmittedVrplMatch
  | CompletedVrplMatch;
export interface PlainVrplMatch {
  id: string;
  tournamentId: string;
  teamIds: string[];
  timeStart: Date;
  timeDeadline: Date;
}
export interface SubmittedVrplMatch extends PlainVrplMatch {
  teamIdsConfirmed: string[];
  /**
   * An array of rounds, which contain scores of teams
   */
  scores: number[][];
  timeSubmitted: Date;
  isForfeit: boolean;
}

export interface CompletedVrplMatch extends SubmittedVrplMatch {
  timeConfirmed: Date;

  winnerId?: string;
  tiedIds?: string[];
  loserIds?: string[];
}
// TODO: Do they need to be optional?

const MatchSchema = new Schema<VrplMatch & Document>(
  {
    id: { type: String, required: true, unique: true },
    tournamentId: String,
    teamIds: [String],
    timeStart: Date,
    timeDeadline: Date,

    teamIdsConfirmed: { type: [String], required: false },
    scores: { type: [[Number]], required: false },
    timeSubmitted: { type: Date, required: false },
    isForfeit: { type: Boolean, required: false },

    timeConfirmed: { type: Date, required: false },
    winnerId: { type: String, required: false },
    tiedIds: { type: [String], required: false },
    loserIds: { type: [String], required: false },
  },
  { collection: "matches" }
);

const MatchModel = model<VrplMatch & Document>("matches", MatchSchema);
export { MatchModel as default };
