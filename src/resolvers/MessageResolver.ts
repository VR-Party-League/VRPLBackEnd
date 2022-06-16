import {
  Arg,
  Ctx,
  FieldResolver,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { Authenticate, Permissions, ResolvePlayer } from "../utils/permissions";
import Message, { MessageInput } from "../schemas/Message";
import { vrplMessage } from "../db/models/vrplMessages";
import { getPlayerFromId } from "../db/player";
import { Context } from "..";
import { BadRequestError, UnauthorizedError } from "../utils/errors";
import {
  createMessages,
  getMessageFromId,
  getMessagesForPlayer,
  hideMessage,
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
  @Query((_returns) => [Message])
  @UseMiddleware(Authenticate(["messages:read"]))
  @UseMiddleware(
    ResolvePlayer("playerId", true, { override: Permissions.ManageMessages })
  )
  async getMessagesForPlayer(
    @Ctx() { auth }: Context,
    @Arg("playerId") playerId: string,
    @Arg("limit", (_type) => Int, { nullable: true }) limit?: number,
    @Arg("skip", (_type) => Int, { nullable: true }) skip?: number,
    @Arg("showHidden", { nullable: true }) showHidden?: boolean
  ): Promise<vrplMessage[]> {
    if (!auth) throw new UnauthorizedError();
    const player = await getPlayerFromId(playerId);
    if (!player) throw new Error("Player not found");
    if (auth.playerId !== player.id)
      auth.assurePerm(Permissions.ManageMessages);
    if (!player) throw new Error("Player not found");
    else if (limit || 0 > 100) throw new BadRequestError("Limit too high");

    const messages = await getMessagesForPlayer(
      playerId,
      limit,
      skip,
      showHidden
    );
    return messages;
  }

  @Mutation((_returns) => [Message])
  @UseMiddleware(
    Authenticate(["USE_PERMISSIONS"], [Permissions.ManageMessages])
  )
  async createMessages(
    @Arg("message") messageArgs: MessageInput,
    @Arg("recipientIds", (_type) => [String]) recipientIds: string[]
  ) {
    if (!recipientIds[0])
      throw new BadRequestError("You must specify at least 1 recipient");
    const res = await createMessages(messageArgs, recipientIds);
    return res;
  }

  @Mutation((_returns) => Int)
  @UseMiddleware(Authenticate(["messages.read:write"]))
  async readAllUnreadMessages(
    @Arg("playerId") playerId: string,
    @Arg("limit", { nullable: true }) limit: number,
    @Arg("reverse", { nullable: true }) reverse: boolean,
    @Arg("messageIds", (_type) => [String], { nullable: true })
    messageIds: string[],
    @Ctx() { auth }: Context
  ) {
    if (!auth) throw new UnauthorizedError();
    const player = await getPlayerFromId(playerId);
    if (!player) throw new Error("Player not found");
    if (auth.playerId !== player.id)
      auth.assurePerm(Permissions.ManageMessages);
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

  @Mutation((_returns) => Message)
  @UseMiddleware(
    ResolvePlayer("playerId", true, { override: Permissions.ManageMessages })
  )
  @UseMiddleware(Authenticate(["messages.hide:write"]))
  async hideMessage(
    @Arg("playerId") playerId: string,
    @Arg("messageId") messageId: string,
    @Ctx() { auth, resolved }: Context
  ) {
    const message = await getMessageFromId(messageId);
    if (!message) throw new BadRequestError("Message not found");
    const res = hideMessage(resolved.player!, message);
    return res;
  }
}
