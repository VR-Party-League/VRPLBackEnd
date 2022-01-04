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
import {
  createMessages,
  getMessagesForPlayer,
  readMessagesOfPlayer,
} from "../db/messages";

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
    @Arg("limit", (_type) => Int, { nullable: true }) limit?: number,
    @Arg("skip", (_type) => Int, { nullable: true }) skip?: number
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
    else if (limit || 0 > 100) throw new BadRequestError("Limit too high");

    const messages = await getMessagesForPlayer(playerId, limit, skip);
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

  @Authorized()
  @Mutation((_returns) => Int)
  async readAllUnreadMessages(
    @Arg("playerId") playerId: string,
    @Arg("limit", { nullable: true }) limit: number,
    @Arg("reverse", { nullable: true }) reverse: boolean,
    @Arg("messageIds", (_type) => [String], { nullable: true })
    messageIds: string[],
    @Ctx() ctx: Context
  ) {
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
    else if ((limit || 0) > 100) throw new BadRequestError("Limit too high");
    else if (messageIds && messageIds.length > 100)
      throw new BadRequestError("to many messageIds");

    const res = await readMessagesOfPlayer(
      playerId,
      limit,
      reverse,
      messageIds
    );
    return res?.modifiedCount;
  }
}
