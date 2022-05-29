import MessageButton from "../schemas/MessageButton";
import {
  Arg,
  Authorized,
  Ctx,
  Field,
  FieldResolver,
  Mutation,
  ObjectType,
  Resolver,
  Root,
} from "type-graphql";
import { vrplMessage, vrplMessageButton } from "../db/models/vrplMessages";
import { Permissions } from "../utils/permissions";
import {
  BadRequestError,
  InternalServerError,
  UnauthorizedError,
} from "../utils/errors";
import { getMessageForPlayerFromId, performButtonAction } from "../db/messages";
import Message from "../schemas/Message";
import { getPlayerFromId } from "../db/player";
import { Context } from "../index";

@Resolver((_of) => MessageButton)
export default class {
  @Authorized([Permissions.Admin])
  @FieldResolver()
  action(@Root() messageButton: vrplMessageButton) {
    return JSON.stringify(messageButton.action);
  }

  @Authorized()
  @Mutation((_returns) => PerformMessageButtonActionResponse)
  async performMessageButtonAction(
    @Arg("playerId") playerId: string,
    @Arg("buttonId") buttonId: string,
    @Arg("messageId") messageId: string,
    @Ctx() { auth }: Context
  ): Promise<{ text: string; message: vrplMessage }> {
    if (!auth) throw new UnauthorizedError();
    const player = await getPlayerFromId(playerId);
    if (!player) throw new BadRequestError("Player not found");
    else if (player.id !== auth.playerId)
      auth.assurePerm(Permissions.ManageMessages);

    const message = await getMessageForPlayerFromId(playerId, messageId);
    if (!message) throw new BadRequestError("Message not found");
    const messageButton = message.buttons.find(
      (button) => button.id === buttonId
    );
    if (!messageButton) throw new BadRequestError("Message button not found");
    if (messageButton.clickedAt)
      throw new BadRequestError("Button already clicked");
    else if (message.isPickOne && message.buttons.some((b) => !!b.clickedAt))
      throw new BadRequestError(
        "A button has already been clicked for this pickOne message."
      );
    const { text, message: newMessage } = await performButtonAction(
      messageButton,
      message,
      player,
      auth
    );
    if (!text) throw new InternalServerError("Button action failed");
    return { text, message: newMessage };
  }
}

@ObjectType()
class PerformMessageButtonActionResponse {
  @Field()
  text: string;
  @Field()
  message: Message;
}
