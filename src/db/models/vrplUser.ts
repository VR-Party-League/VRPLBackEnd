import { model, ObjectId, Schema } from "mongoose";

export interface VrplUser {
  _id: ObjectId;
  password?: {
    username: string;
    hash: string;
    salt: string;
    iterations: number;
    keyLength: number;
  };
  discordId?: string;
  permissions: number;

  playerId?: string;
}

const VrplUserModel = model(
  "users",
  new Schema<VrplUser>({
    _id: { type: Schema.Types.ObjectId, required: true, auto: true },
    password: {
      type: {
        username: { type: String, required: true },
        hash: { type: String, required: true },
        salt: { type: String, required: true },
        iterations: { type: Number, required: true },
        keyLength: { type: Number, required: true },
      },
      required: false,
    },
    discordId: { type: String, required: false },
    permissions: { type: Number, required: true },

    playerId: { type: String, required: false },
  })
);

export default VrplUserModel;
