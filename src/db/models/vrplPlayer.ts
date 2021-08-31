import { Schema, model, Document } from "mongoose";

export interface VrplPlayer {
  id: string;
  nickname: string;
  avatar?: string; // TODO: set up s3
  about: string;
  email: string;
  region?: string;

  discordId: string;
  discordTag: string;
  discordAvatar?: string;

  flags: number;
  badgeField: number;
  permissions: number;
  timeCreated: Date;
}

const PlayerSchema = new Schema<VrplPlayer & Document>(
  {
    id: { type: String, required: true, unique: true },
    nickname: { type: String, require: true },
    avatar: { type: String, require: true },
    about: { type: String, require: false },
    email: { type: String, require: true },
    region: { type: String, require: false },

    discordId: { type: String, required: true, unique: true },
    discordTag: { type: String, required: true },
    discordAvatar: { type: String, require: true },

    flags: { type: Number, required: true, default: 0 },
    badgeField: { type: Number, required: true, default: 0 },
    permissions: { type: Number, required: true, default: 0 },
    timeCreated: { type: Date, require: true },
  },
  { collection: "players" }
);

const PlayerModel = model<VrplPlayer & Document>("players", PlayerSchema);
export { PlayerModel as default };
