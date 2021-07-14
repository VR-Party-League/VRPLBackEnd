import { Schema, model, connect, Document } from "mongoose";

export interface ApiToken {
  DiscordID: string;
  ApiToken: string;
  TimeStamp: Date;
  //Uses: number;
}

const ApiTokenSchema = new Schema<ApiToken & Document>(
  {
    DiscordID: { type: String, required: true, unique: true },
    ApiToken: { type: String, required: true, unique: true },
    TimeStamp: { type: Date, required: true },
    //Uses: { type: Number, required: true, default: 0 },
  },
  { collection: "ApiTokens" }
);

export const ApiTokenModel = model<ApiToken & Document>(
  "ApiTokens",
  ApiTokenSchema
);
