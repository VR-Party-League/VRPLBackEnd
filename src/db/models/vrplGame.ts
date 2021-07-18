import { Schema, model, Document } from "mongoose";

export interface VrplGame {
  id: string;
}

const GameSchema = new Schema<VrplGame & Document>(
  {
    id: { type: String, required: true, unique: true },
    name: String,
    description: String,
    banner: String,
  },
  { collection: "games" }
);

const GameModel = model<VrplGame & Document>("games", GameSchema);
export { GameModel as default };
