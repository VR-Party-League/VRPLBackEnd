import { Schema, model, Document } from "mongoose";
import { VrplPlayer } from "./vrplPlayer";

export interface VrplTeam {
  captainID: string;
  id: string;
  name: string;
  playerIDs: string[];
  pendingPlayerIDs: string[];
  tournamentId: string;
}

const TeamSchema = new Schema<VrplTeam & Document>(
  {
    captainID: String,
    id: { type: String, required: true, unique: true },
    name: String,
    playerIDs: [String],
    pendingPlayerIDs: [String],
    tournamentId: String,
  },
  { collection: "teams" }
);

const TeamModel = model<VrplTeam & Document>("teams", TeamSchema);
export { TeamModel as default };
