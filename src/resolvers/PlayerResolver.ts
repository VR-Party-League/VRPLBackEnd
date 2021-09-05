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
import { Context } from "..";
import {
  getAllBadges,
  getBadgeFromBitPosition,
  getBadgesFromBitField,
} from "../db/badge";
import {
  addPlayerCooldown,
  doesPlayerHaveCooldown,
  getPlayerCooldowns,
} from "../db/cooldown";
import { VrplPlayerCooldown } from "../db/models/cooldowns";
import { VrplBadge } from "../db/models/vrplBadge";
import { VrplPlayer } from "../db/models/vrplPlayer";
import { VrplTeam } from "../db/models/vrplTeam";
import {
  getPlayerFromDiscordId,
  getPlayerFromId,
  getPlayerFromNickname,
  updatePlayerBadges,
  updatePlayerName,
} from "../db/player";
import { getAllTeamsOfPlayer } from "../db/team";
import Player from "../schemas/Player";
import { findPositions } from "../utils/bitFields";
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
} from "../utils/errors";
import { Permissions, userHasPermission } from "../utils/permissions";

@Resolver((_of) => Player)
export default class {
  @Query((_returns) => Player, { nullable: true })
  async playerFromId(
    @Arg("playerId") playerId: string
  ): Promise<VrplPlayer | null> {
    return await getPlayerFromId(playerId);
  }
  @Query((_returns) => Player, { nullable: true })
  playerFromDiscordId(
    @Arg("discordId") discordId: string
  ): Promise<VrplPlayer | null> {
    return getPlayerFromDiscordId(discordId);
  }
  @FieldResolver()
  nicknameHistory(
    @Root() vrplPlayer: VrplPlayer
  ): VrplPlayer["nicknameHistory"] {
    return vrplPlayer.nicknameHistory;
  }

  @FieldResolver()
  teams(@Root() vrplPlayer: VrplPlayer): Promise<VrplTeam[]> {
    return getAllTeamsOfPlayer(vrplPlayer.id);
  }
  @FieldResolver()
  badges(@Root() vrplPlayer: VrplPlayer): Promise<VrplBadge[]> {
    return getBadgesFromBitField(vrplPlayer.badgeField);
  }

  @FieldResolver()
  cooldowns(@Root() vrplPlayer: VrplPlayer): Promise<VrplPlayerCooldown[]> {
    return getPlayerCooldowns(vrplPlayer.id);
  }

  @Authorized([Permissions.ManageBadges])
  @Mutation((_returns) => Player)
  async addBadgeToPlayer(
    @Arg("playerId") playerId: string,
    @Arg("bitPosition", (_type) => Int) bitPosition: number,
    @Ctx() ctx: Context
  ): Promise<VrplPlayer> {
    const user = ctx.user;
    if (!user) throw new InternalServerError("No user found in context");
    const vrplPlayer = await getPlayerFromId(playerId);
    if (!vrplPlayer) throw new BadRequestError("Player not found");
    const playerBadges = vrplPlayer.badgeField;
    const badge = await getBadgeFromBitPosition(bitPosition);
    if (!badge) throw new BadRequestError("No badge found with that position");
    const newBadgeBitField = playerBadges | (1 << bitPosition);
    return await updatePlayerBadges(vrplPlayer, newBadgeBitField, user.id);
  }

  @Authorized([Permissions.ManageBadges])
  @Mutation((_returns) => Player)
  async removeBadgeFromPlayer(
    @Arg("playerId") playerId: string,
    @Arg("bitPosition", (_type) => Int) bitPosition: number,
    @Ctx() ctx: Context
  ): Promise<VrplPlayer> {
    const user = ctx.user;
    if (!user) throw new InternalServerError("No user found in context");
    const vrplPlayer = await getPlayerFromId(playerId);
    if (!vrplPlayer) throw new BadRequestError("Player not found");
    const playerBadges = vrplPlayer.badgeField;
    const badge = await getBadgeFromBitPosition(bitPosition);
    if (!badge) throw new BadRequestError("No badge found with that position");
    const newBadgeBitField = playerBadges & ~(1 << bitPosition);
    if (newBadgeBitField === playerBadges)
      throw new BadRequestError("Player doesn't have this badge");
    return await updatePlayerBadges(vrplPlayer, newBadgeBitField, user.id);
  }

  @Authorized([Permissions.ManageBadges])
  @Mutation((_returns) => Player)
  async setBadgesOfPlayer(
    @Arg("playerId") playerId: string,
    @Arg("bitField", (_type) => Int) bitField: number,
    @Ctx() ctx: Context
  ): Promise<VrplPlayer> {
    const user = ctx.user;
    if (!user) throw new InternalServerError("No user found in context");
    const vrplPlayer = await getPlayerFromId(playerId);
    if (!vrplPlayer) throw new BadRequestError("Player not found");
    const positionsInBitField = findPositions(bitField);
    const allBadges = await getAllBadges();
    const notFound = positionsInBitField.some((pos) => {
      return !allBadges.some((badge) => badge.bitPosition === pos);
    });

    if (typeof notFound === "number")
      throw new BadRequestError(
        "One or more badges not found, bitPosition: " + notFound
      );

    return await updatePlayerBadges(vrplPlayer, bitField, user.id);
  }

  @Authorized()
  @Mutation((_returns) => Player)
  async changePlayerName(
    @Arg("playerId") playerId: string,
    @Arg("newName") newName: string,
    @Ctx() ctx: Context
  ) {
    const user = ctx.user;
    if (!user) throw new InternalServerError("No user found in context");
    const vrplPlayer = await getPlayerFromId(playerId);
    if (!vrplPlayer) throw new BadRequestError("Player not found");
    const foundPlayer = await getPlayerFromNickname(newName);
    if (foundPlayer)
      throw new BadRequestError("A player with that name already exists.");

    const userHasPerms = userHasPermission(user, Permissions.ManagePlayers);
    if (!userHasPerms) {
      if (vrplPlayer.id !== user.id)
        throw new ForbiddenError("You can't change other players' names");
      const hasCooldown = await doesPlayerHaveCooldown(
        playerId,
        "changeNickname"
      );
      if (hasCooldown) throw new BadRequestError("You are on a cooldown!");
    }
    const newPlayer = await updatePlayerName(vrplPlayer, newName, user.id);
    if (!userHasPerms) await addPlayerCooldown(playerId, "changeNickname");
    return newPlayer;
  }

  @Authorized()
  @Mutation((_returns) => Player)
  async setPlayerRegion(
    @Arg("playerId") playerId: string,
    @Arg("region") newName: string,
    @Ctx() ctx: Context
  ) {
    // TODO: Do this!!!!
  }
}
