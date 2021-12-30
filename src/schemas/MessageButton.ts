import { Authorized, Field, InputType, ObjectType } from "type-graphql";
import { Permissions } from "../utils/permissions";

@ObjectType()
export default class MessageButton {
  @Field({ description: "The button id", nullable: false })
  id: string;

  @Field({ description: "The button text", nullable: false })
  text: string;

  @Authorized([Permissions.Admin])
  @Field({
    description:
      "The button action, only for debug purposes, and a JSON string bc i dont know how to have like an 'any' type",
    nullable: false,
  })
  action: string;

  @Field({
    description:
      "The button color, as a string representation of a hex number (#3ff021)",
    nullable: true,
  })
  colorHex: string;

  @Field({
    description: "The button icon, as a link to an svg",
    nullable: true,
  })
  icon: string;

  @Field({
    description:
      "When the recipient clicked the button (you can only click a button once)",
    nullable: true,
  })
  clickedAt: Date;
}

@InputType()
export class MessageButtonActionInput {
  @Field({
    description:
      "The type of the action, currently there are only 'AcceptTeamInvite' 'DeclineTeamInvite' or 'Debug'",
    nullable: false,
  })
  type: string;
  @Field({
    description: "Team id for if the action requires that",
    nullable: true,
  })
  teamId: string;
  @Field({
    description:
      "Tournament id for if the action requires that (this is always required if the teamId is required)",
    nullable: true,
  })
  tournamentId: string;
  @Field({
    description:
      "Player id (currently not used for anything so dont use it dum dum)",
    nullable: true,
  })
  playerId: string;
}

@InputType()
export class MessageButtonInput {
  @Field({ description: "The text of the button", nullable: false })
  text: string;
  @Field({
    description: "The color of the button as a hex string",
    nullable: true,
  })
  colorHex: string;
  @Field({
    description: "The icon of the button, a link to an svg",
    nullable: true,
  })
  icon: string;

  @Field({
    description: "The action the button will perform when pressed",
    nullable: false,
  })
  action: MessageButtonActionInput;
}
