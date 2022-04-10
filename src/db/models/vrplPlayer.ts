import { Document, model, Schema } from "mongoose";
import { registerEnumType } from "type-graphql";
import { VrplTeam } from "./vrplTeam";

// Nickname history
export interface VrplPlayerNickname {
  nickname: string;
  replacedAt: Date;
}

// const VrplPlayerNicknameSchema = new Schema<VrplPlayerNickname & Document>({
//   nickname: String,
//   replacedAt: Date,
// });

// Player model
export enum VrplRegion {
  NA = "NA",
  EU = "EU",
  ASIA = "ASIA",
  OCEANIA = "OCEANIA",
  UNKNOWN = "UNKNOWN",
}

registerEnumType(VrplRegion, {
  name: "VrplRegion", // this one is mandatory
});

export interface VrplPlayer {
  id: string;
  nickname: string;
  nicknameHistory: VrplPlayerNickname[];
  about: string;
  email: string;
  region: VrplRegion;

  avatarHash?: string;

  discordId: string;
  discordTag: string;
  discordAvatar?: string;

  badgeField: number;
  permissions: number;
  timeCreated: Date;
}

const PlayerSchema = new Schema<VrplPlayer & Document>(
  {
    id: { type: String, required: true, unique: true, index: true },
    nickname: { type: String, require: true, text: true },
    nicknameHistory: {
      type: [
        {
          nickname: String,
          replacedAt: Date,
        },
      ],
      required: true,
    },
    //    avatar: { type: String, require: true },
    about: { type: String, require: true },
    email: { type: String, require: true },
    region: {
      type: String,
      require: true,
      default: VrplRegion.UNKNOWN,
      enum: VrplRegion,
    },

    avatarHash: String,

    discordId: { type: String, required: true, unique: true, index: true },
    discordTag: { type: String, required: true, index: true },
    discordAvatar: { type: String, require: true },

    badgeField: { type: Number, required: true, default: 0 },
    permissions: { type: Number, required: true, default: 0 },
    timeCreated: { type: Date, require: true },
  },
  { collection: "players" }
);

export function isPlayer(obj: VrplPlayer | VrplTeam): obj is VrplPlayer {
  let teamOrPlayer = obj as VrplPlayer;
  if (
    !teamOrPlayer.id ||
    !teamOrPlayer.email ||
    !teamOrPlayer.nickname ||
    !teamOrPlayer.about
  )
    return false;
  return true;
}

const PlayerModel = model<VrplPlayer & Document>("players", PlayerSchema);
export { PlayerModel as default };
