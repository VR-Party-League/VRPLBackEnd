import { Document, model, Schema } from "mongoose";

export enum VrplStrikeType {
  tempBan = "tempBan",
  restrict = "restrict",
}

export interface VrplStrike {
  id: string;
  filedAt: Date;
  offenderId: string;
  punishment: VrplStrikeType;
  duration: string;
  violation: string;
  notes: string;
  filedById: string;
}

const StrikeSchema = new Schema<VrplStrike & Document>(
  {
    id: { type: String, required: true, unique: true },
  },
  { collection: "strikes" }
);

const StrikeModel = model<VrplStrike & Document>("strikes", StrikeSchema);
export default StrikeModel;

// TODO: appeals
// TODO: punishments
// TODO: all of this really
/*


*/
