import { Schema, model, connect, Document, ObjectId } from "mongoose";
import { VrplUser } from "./vrplUser";

export interface VrplApiToken {
  userId: ObjectId;
  user: VrplUser;
  apiToken: string;
  createdAt: Date;
  //Uses: number;
}

const ApiTokenSchema = new Schema<VrplApiToken & Document>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      unique: true,
    },
    user: { type: Object },
    apiToken: { type: String, required: true, index: true, unique: true },
    createdAt: { type: Date, required: true },
    //Uses: { type: Number, required: true, default: 0 },
  },
  { collection: "OAuthApiTokens" }
);

export const ApiTokenModel = model<VrplApiToken & Document>(
  "OAuthApiTokens",
  ApiTokenSchema
);
