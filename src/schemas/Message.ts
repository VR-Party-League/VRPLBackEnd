import { Authorized, Field, InputType, Int, ObjectType } from "type-graphql";
import MessageButton, { MessageButtonInput } from "./MessageButton";
import Player from "./Player";

@ObjectType()
export default class Message {
  @Field({ description: "The message id", nullable: false })
  id: string;

  @Field({ description: "The recipient of the message", nullable: false })
  recipient: Player;

  @Field({ description: "The title of the post", nullable: false })
  title: string;

  @Field({ description: "The main content of the post", nullable: false })
  content: string;

  @Field({
    description:
      "The user that sent the message, if its undefined it got sent by the system",
    nullable: true,
  })
  sender: Player; // If this is not a string it has been sent by "SYSTEM" :ooo

  // @Field({ description: "An link to an image", nullable: true })
  // thumbnail: string;

  @Field((_type) => [MessageButton], {
    description: "An link to an image",
    nullable: false,
  })
  buttons: MessageButton[];

  @Field({
    description: "When the message was created / sent",
    nullable: false,
  })
  createdAt: Date;
  @Field({
    description: "When the message was first shown to the user",
    nullable: true,
  })
  readAt?: Date;
  @Field({
    description: "When the message was hidden by the recipient",
    nullable: true,
  })
  hiddenAt?: Date;
}

@InputType("MessageInput")
export class MessageInput {
  @Field({ description: "The title of the message" })
  title: string;
  @Field({ description: "The main content of the message" })
  content: string;
  @Field({
    description:
      "If this is set it wil send as a user, if it isnt it will be sent from [SYSTEM]",
    nullable: true,
  })
  senderId: string;
  @Field((_type) => [MessageButtonInput], {
    description: "These are the clickable buttons of the message",
  })
  buttons: MessageButtonInput[];
}
