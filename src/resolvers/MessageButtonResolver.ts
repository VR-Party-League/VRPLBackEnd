import MessageButton from "../schemas/MessageButton";
import {
  Arg,
  Authorized,
  Ctx,
  FieldResolver,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { vrplMessageButton } from "../db/models/vrplMessages";
import { Permissions } from "../utils/permissions";
import {
  BadRequestError,
  InternalServerError,
  UnauthorizedError,
} from "../utils/errors";
import { getMessageForPlayerFromId, performButtonAction } from "../db/messages";
import Message from "../schemas/Message";

@Resolver((_of) => MessageButton)
export default class {
  @Authorized([Permissions.Admin])
  @FieldResolver()
  action(@Root() messageButton: vrplMessageButton) {
    return JSON.stringify(messageButton.action);
  }

  @Authorized()
  @Mutation((_returns) => Message)
  async performMessageButtonAction(
    @Arg("buttonId") buttonId: string,
    @Arg("messageId") messageId: string,
    @Ctx() ctx: any
  ) {
    const user = ctx.user;
    if (!user) throw new UnauthorizedError("No user found");
    const message = await getMessageForPlayerFromId(user.id, messageId);
    if (!message) throw new BadRequestError("Message not found");
    const messageButton = message.buttons.find(
      (button) => button.id === buttonId
    );
    if (!messageButton) throw new BadRequestError("Message button not found");
    if (messageButton.clickedAt)
      throw new BadRequestError("Button already clicked");

    const res = await performButtonAction(messageButton, messageId, user.id);
    if (!res) throw new InternalServerError("Button action failed");
    return res;
  }
}
