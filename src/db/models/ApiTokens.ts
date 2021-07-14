import { Schema, model, connect, Document } from "mongoose";

export interface ApiToken {
  playerId: string;
  apiToken: string;
  timestamp: Date;
  //Uses: number;
}

const ApiTokenSchema = new Schema<ApiToken & Document>(
  {
    playerId: { type: String, required: true, unique: true },
    apiToken: { type: String, required: true, unique: true },
    timestamp: { type: Date, required: true },
    //Uses: { type: Number, required: true, default: 0 },
  },
  { collection: "apiTokens" }
);

export const ApiTokenModel = model<ApiToken & Document>(
  "apiTokens",
  ApiTokenSchema
);
