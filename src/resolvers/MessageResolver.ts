import MessageButton from "../schemas/MessageButton";
import {
  Arg,
  Authorized,
  createUnionType,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { Permissions, userHasPermission } from "../utils/permissions";
import Message, { MessageInput } from "../schemas/Message";
import MessageModel, { vrplMessage } from "../db/models/vrplMessages";
import { getPlayerFromId } from "../db/player";
import { getAvatar } from "../utils/storage";
import { Context } from "..";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "../utils/errors";
import { createMessages } from "../db/messages";

@Resolver((_of) => Message)
export default class {
  @FieldResolver()
  recipient(@Root() message: vrplMessage) {
    return getPlayerFromId(message.recipientId);
  }

  @FieldResolver()
  sender(@Root() message: vrplMessage) {
    if (!message.senderId) return undefined;
    return getPlayerFromId(message.senderId);
  }

  // @FieldResolver()
  // thumbnail(@Root() message: vrplMessage) {
  //   if (!message.thumbnailData) return undefined;
  //   const { thumbnailData } = message;

  //   if (type === "team" || type === "player") getAvatar(type, id);
  // }
  @Authorized()
  @Query((_returns) => [Message])
  async getMessagesForPlayer(
    @Ctx() ctx: Context,
    @Arg("playerId") playerId: string,
    @Arg("limit", (_type) => Int, { nullable: true }) limit?: number
  ): Promise<vrplMessage[]> {
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();
    const player = await getPlayerFromId(playerId);
    if (!player) throw new Error("Player not found");
    if (
      user.id !== player.id &&
      !userHasPermission(user, Permissions.ManageMessages)
    )
      throw new ForbiddenError();
    if (!player) throw new Error("Player not found");

    const query = MessageModel.find({
      $or: [{ senderId: playerId }, { recipientId: playerId }],
    }).sort({ createdAt: -1 });
    if (limit) query.limit(limit);
    const messages = await query;
    return messages;
  }

  @Authorized([Permissions.ManageMessages])
  @Mutation((_returns) => [Message])
  async createMessages(
    @Arg("message") messageArgs: MessageInput,
    @Arg("recipientIds", (_type) => [String]) recipientIds: string[]
  ) {
    if (!recipientIds[0])
      throw new BadRequestError("You must specify at least 1 recipient");
    const res = await createMessages(messageArgs, recipientIds);
    return res;
  }
}
