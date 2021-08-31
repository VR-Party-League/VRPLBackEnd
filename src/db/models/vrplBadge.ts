import { Schema, model, connect, Document } from "mongoose";

export interface VrplBadge {
  bitPosition: number;
  icon: string;
  name: string;
  description: string;
  createdAt: Date;
  //Uses: number;
}

const BadgeSchema = new Schema<VrplBadge & Document>(
  {
    bitPosition: { type: Number, required: true, unique: true },
    icon: { type: String, required: true },
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    createdAt: { type: Date, required: true },

    //Uses: { type: Number, required: true, default: 0 },
  },
  { collection: "badges" }
);

const BadgeModel = model<VrplBadge & Document>("badges", BadgeSchema);
export default BadgeModel;
