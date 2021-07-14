import { Schema, model, Document } from "mongoose";

export interface VrplPlayer {
  id: string;
  discordId: string;
  discordTag: string;
  discordAvatar?: string;
  permissions: number;
}

const PlayerSchema = new Schema<VrplPlayer & Document>(
  {
    id: { type: String, required: true, unique: true },
    discordId: { type: String, required: true, unique: true },
    discordTag: { type: String, required: true },
    discordAvatar: { type: String, require: true },
    permissions: { type: Number, required: true, default: 0 },
  },
  { collection: "players" }
);

const PlayerModel = model<VrplPlayer & Document>("players", PlayerSchema);
export { PlayerModel as default };
