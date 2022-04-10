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
  UnauthorizedError,
} from "type-graphql";
import { Context } from "..";
import {
  getAllBadges,
  getBadgeFromBitPosition,
  getBadgesFromBitField,
} from "../db/badge";
import {
  addCooldown,
  doesHaveCooldown,
  getPlayerCooldowns,
} from "../db/cooldown";
import { VrplPlayerCooldown } from "../db/models/cooldowns";
import { VrplBadge } from "../db/models/vrplBadge";
import { VrplPlayer, VrplRegion } from "../db/models/vrplPlayer";
import { VrplTeam } from "../db/models/vrplTeam";
import {
  findPlayerBroadly,
  getAllPlayerIds,
  getPlayerFromDiscordId,
  getPlayerFromId,
  getPlayerFromNickname,
  refreshDiscordData,
  setPlayerRegion,
  updatePlayerAbout,
  updatePlayerBadges,
  updatePlayerEmail,
  updatePlayerName,
  validateEmail,
} from "../db/player";
import { getAllTeamsOfPlayer } from "../db/team";
import Player from "../schemas/Player";
import { findPositions } from "../utils/bitFields";
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
} from "../utils/errors";
import {
  Permissions,
  userHasOneOfPermissions,
  userHasPermission,
} from "../utils/permissions";
import { getAvatar } from "../utils/storage";

@Resolver((_of) => Player)
export default class {
  @Query((_returns) => Player, { nullable: true })
  async playerFromId(
    @Arg("playerId") playerId: string
  ): Promise<VrplPlayer | null> {
    return await getPlayerFromId(playerId);
  }

  @Authorized([Permissions.Server])
  @Query((_returns) => [String])
  async allPlayerIds(): Promise<string[]> {
    return await getAllPlayerIds();
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
  async teams(@Root() vrplPlayer: VrplPlayer): Promise<VrplTeam[]> {
    return await getAllTeamsOfPlayer(vrplPlayer.id);
  }

  @FieldResolver()
  badges(@Root() vrplPlayer: VrplPlayer): Promise<VrplBadge[]> {
    return getBadgesFromBitField(vrplPlayer.badgeField);
  }

  @FieldResolver()
  cooldowns(@Root() vrplPlayer: VrplPlayer): Promise<VrplPlayerCooldown[]> {
    return getPlayerCooldowns(vrplPlayer.id);
  }

  @FieldResolver()
  async avatar(
    @Root() { avatarHash, id }: VrplPlayer
  ): Promise<string | undefined> {
    if (!avatarHash) return undefined;
    return await getAvatar("player", id, avatarHash);
  }

  @Authorized()
  @FieldResolver()
  discordId(@Root() vrplPlayer: VrplPlayer, @Ctx() ctx: Context) {
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();
    else if (
      user.id !== vrplPlayer.id &&
      !userHasOneOfPermissions(user, [
        Permissions.ManagePlayers,
        Permissions.AccessDiscordId,
      ])
    )
      throw new ForbiddenError();
    return vrplPlayer.discordId;
  }

  @Authorized()
  @Query((_returns) => Player, { nullable: true })
  async findPlayer(
    @Arg("search") search: string,
    @Ctx() ctx: Context
  ): Promise<VrplPlayer | null> {
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();

    return await findPlayerBroadly(search);
  }

  @Authorized()
  @FieldResolver()
  email(
    @Root() vrplPlayer: VrplPlayer,
    @Ctx() ctx: Context
  ): VrplPlayer["email"] {
    if (!ctx.user) throw new UnauthorizedError();
    else if (
      ctx.user.id !== vrplPlayer.id &&
      !userHasPermission(ctx.user, Permissions.Admin)
    )
      throw new ForbiddenError();
    return vrplPlayer.email;
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
      const hasCooldown = await doesHaveCooldown(
        "player",
        playerId,
        "changeNickname"
      );
      if (hasCooldown) throw new BadRequestError("You are on a cooldown!");
    }
    const newPlayer = await updatePlayerName(vrplPlayer, newName, user.id);
    if (!userHasPerms) await addCooldown("player", playerId, "changeNickname");
    return newPlayer;
  }

  @Authorized()
  @Mutation((_returns) => Player)
  async setPlayerRegion(
    @Arg("playerId") playerId: string,
    @Arg("region") region: string,
    @Ctx() ctx: Context
  ) {
    const user = ctx.user;
    if (!user) throw new InternalServerError("No user found in context");
    const player = await getPlayerFromId(playerId);
    if (!player) throw new BadRequestError("Player not found");
    const userHasPerms = userHasPermission(user, Permissions.ManagePlayers);
    if (player.id !== user.id && !userHasPerms)
      throw new ForbiddenError("You can't change other players' regions");

    if (!Object.keys(VrplRegion).includes(region))
      throw new BadRequestError(
        `Invalid region, options are: ${Object.keys(VrplRegion).join(", ")} `
      );
    return await setPlayerRegion(player, region as VrplRegion, user.id);
  }

  @Authorized()
  @Mutation((_returns) => Player)
  async updateEmail(
    @Arg("playerId") playerId: string,
    @Arg("email") email: string,
    @Ctx() ctx: Context
  ) {
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();
    const player = await getPlayerFromId(playerId);
    if (!player) throw new BadRequestError("Player not found");
    const userHasPerms = userHasPermission(user, Permissions.Admin);
    if (player.id !== user.id && !userHasPerms)
      throw new ForbiddenError("You can't change other players' regions");
    const validEmail = await validateEmail(email);
    if (!validEmail) throw new BadRequestError("Invalid email address");
    return await updatePlayerEmail(player, email, user.id);
  }

  @Authorized()
  @Mutation((_returns) => Player)
  async refreshDiscordData(
    @Arg("playerId") playerId: string,
    @Ctx() ctx: Context
  ): Promise<VrplPlayer> {
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();
    const player = await getPlayerFromId(playerId);
    if (!player) throw new BadRequestError("Player not found");
    const userHasPerms = userHasPermission(user, Permissions.ManagePlayers);
    if (player.id !== user.id && !userHasPerms) throw new ForbiddenError();
    return await refreshDiscordData(player);
  }

  @Authorized()
  @Mutation((_returns) => Player)
  async changePlayerAbout(
    @Arg("playerId") playerId: string,
    @Arg("about") about: string,
    @Ctx() ctx: Context
  ) {
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();
    const player = await getPlayerFromId(playerId);
    if (!player) throw new BadRequestError("Player not found");
    const userHasPerms = userHasPermission(user, Permissions.ManagePlayers);
    if (player.id !== user.id && !userHasPerms) throw new ForbiddenError();
    else if (about.length > 1500)
      throw new BadRequestError(
        "About text can't be longer than 1500 characters"
      );

    return await updatePlayerAbout(player, about, user.id);
  }
}
