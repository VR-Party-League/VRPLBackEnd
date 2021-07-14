import { Schema, model, Document } from "mongoose";

export interface VrplMatch {
  Tournament: string;
  Team1: string;
  Team2?: string;

  Scores?: string[];

  Timestamp: Date;
  End: Date;
}

const MatchSchema = new Schema<VrplMatch & Document>(
  {
    Tournament: String,
    Team1: String,
    Team2: { type: String, required: false },

    Scores: { type: [String], required: false },

    Timestamp: Date,
    End: Date,
  },
  { collection: "players" }
);

const MatchModel = model<VrplMatch & Document>("players", MatchSchema);
export { MatchModel as default };
