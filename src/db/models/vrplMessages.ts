import { Schema, model, Document } from "mongoose";

export enum MessageButtonActionTypes {
  AcceptTeamInvite = "AcceptTeamInvite",
  DeclineTeamInvite = "DeclineTeamInvite",
  Debug = "Debug",
}

export interface vrplBaseMessageButtonActions {
  type: MessageButtonActionTypes;
}

export interface JoinTeamAction extends vrplBaseMessageButtonActions {
  type: MessageButtonActionTypes.AcceptTeamInvite;
  teamId: string;
  tournamentId: string;
}

export interface DeclineTeamAction extends vrplBaseMessageButtonActions {
  type: MessageButtonActionTypes.DeclineTeamInvite;
  teamId: string;
  tournamentId: string;
}

export interface DebugAction extends vrplBaseMessageButtonActions {
  type: MessageButtonActionTypes.Debug;
}

export type MessageButtonActions =
  | JoinTeamAction
  | DeclineTeamAction
  | DebugAction;

export interface vrplMessageButton {
  id: string;
  text: string;
  action: MessageButtonActions;
  colorHex?: string;
  icon?: string;
  clickedAt?: Date;
}

export interface vrplMessage {
  id: string;
  recipientId: string;
  title: string;
  content: string;
  senderId?: string; // If this is not a string it has been sent by "SYSTEM" :ooo
  // thumbnailData?:
  //   | {
  //       playerId: string;
  //     }
  //   | {
  //       teamId: string;
  //       tournamentId: string;
  //     };
  buttons: vrplMessageButton[];
  createdAt: Date;
  readAt?: Date;
  hiddenAt?: Date;
}

const MessageSchema = new Schema<vrplMessage & Document>(
  {
    id: { type: String, required: true, unique: true },
    recipientId: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },

    // thumbnailData: {
    //   type: [String],
    //   required: false,
    // },
    buttons: {
      type: [
        {
          id: { type: String, required: true, unique: true },
          text: { type: String, required: true },
          action: { type: Object, required: true },
          colorHex: String,
          icon: String,
          clickedAt: Date,
        },
      ],
      required: false,
    },

    createdAt: Date,
    readAt: Date,
    hiddenAt: Date,
  },
  { collection: "messages" }
);

const MessageModel = model<vrplMessage & Document>("messages", MessageSchema);
export { MessageModel as default };
