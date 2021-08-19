import { Schema, model, Document } from "mongoose";

export interface VrplGameField {
  title: string;
  value: string;
}
export interface VrplGame {
  id: string;
  name: string;
  description: string;
  banner: string;
  fields: VrplGameField[];
}

const GameSchema = new Schema<VrplGame & Document>(
  {
    id: { type: String, required: true, unique: true },
    name: String,
    description: String,
    banner: String,
    fields: [Object],
  },
  { collection: "games" }
);

const GameModel = model<VrplGame & Document>("games", GameSchema);
export { GameModel as default };
