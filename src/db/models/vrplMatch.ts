import { Schema, model, Document } from "mongoose";

export interface VrplMatch {
  id: string;
  tournamentId: string;
  teamIds: string[];
  scores?: number[][];

  teamIdsConfirmed: string[];

  timeStart: Date;
  timeDeadline: Date;
  timeSubmitted?: Date;
  timeConfirmed?: Date;
}

const MatchSchema = new Schema<VrplMatch & Document>(
  {
    id: { type: String, required: true, unique: true },
    tournamentId: String,
    teamIds: [String],
    scores: { type: [[Number]], required: false },

    teamIdsConfirmed: [String],

    timeStart: Date,
    timeDeadline: Date,
    timeSubmitted: { type: Date, required: false },
    timeConfirmed: { type: Date, required: false },
  },
  { collection: "matches" }
);

const MatchModel = model<VrplMatch & Document>("matches", MatchSchema);
export { MatchModel as default };
