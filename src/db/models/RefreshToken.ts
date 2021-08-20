import { Schema, model, connect, Document } from "mongoose";

export interface RefreshToken {
  token: string;
  expireAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdByIp: string;
  updatedByIp: string;
  userId: string;
}

export interface RevokedRefreshToken {}
const RefreshTokenSchema = new Schema<RefreshToken & Document>(
  {
    token: { type: String, required: true, unique: true },
    expireAt: { type: Date, required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    createdByIp: { type: String, required: true },
    updatedByIp: { type: String, required: true },
    userId: { type: String, required: true },
  },
  { collection: "refreshTokens" }
);

const RefreshTokenDB = model<RefreshToken & Document>(
  "refreshTokens",
  RefreshTokenSchema
);
export default RefreshTokenDB;
