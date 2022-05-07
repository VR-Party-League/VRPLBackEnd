import { Schema, model, connect, Document } from "mongoose";
import {
  VrplPlayerCooldownType,
  VrplTeamCooldownType,
} from "../../utils/cooldowns";

export type Cooldown = VrplPlayerCooldown | VrplTeamCooldown;

export interface VrplPlayerCooldown {
  id: string;
  for: "player";
  playerId: string;
  type: VrplPlayerCooldownType;
  createdAt: Date;
  expiresAt: Date;
}

export interface VrplTeamCooldown {
  id: string;
  for: "team";
  teamId: string;
  tournamentId: string;
  type: VrplTeamCooldownType;
  createdAt: Date;
  expiresAt: Date;
}

const CooldownSchema = new Schema<Cooldown & Document>(
  {
    id: { type: String, required: true, unique: true },
    for: { type: String, required: true },
    type: { type: String, required: true },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },

    playerId: { type: String, required: false },
    teamId: { type: String, required: false },
    tournamentId: { type: String, required: false },
  },
  { collection: "cooldowns" }
);

const CooldownModel = model("cooldowns", CooldownSchema);
export default CooldownModel;
