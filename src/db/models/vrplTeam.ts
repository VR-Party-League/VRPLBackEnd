import { Schema, model, Document } from "mongoose";
import { VrplPlayer } from "./vrplPlayer";

export interface VrplTeam {
  captainId: string;
  id: string;
  name: string;
  playerIds: string[];
  pendingPlayerIds: string[];
  tournamentId: string;
}

const TeamSchema = new Schema<VrplTeam & Document>(
  {
    captainId: String,
    id: { type: String, required: true, unique: true },
    name: String,
    playerIds: [String],
    pendingPlayerIds: [String],
    tournamentId: String,
  },
  { collection: "teams" }
);

const TeamModel = model<VrplTeam & Document>("teams", TeamSchema);
export { TeamModel as default };
