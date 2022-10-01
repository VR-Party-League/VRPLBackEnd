import {
  Arg,
  Ctx,
  FieldResolver,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
  UnauthorizedError,
  UseMiddleware,
} from "type-graphql";
import { Context } from "..";
import {
  getAllBadges,
  getBadgeFromBitPosition,
  getBadgesFromBitField,
} from "../db/badge";
import {
  addCooldownToPlayer,
  getPlayerCooldownExpiresAt,
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
  Authenticate,
  Permissions,
  ResolvePlayer,
  userHasOneOfPermissions,
} from "../utils/permissions";
import { getAvatar } from "../utils/storage";
import { revalidatePlayerPages } from "../db/records";

@Resolver((_of) => Player)
export default class {
  @Query((_returns) => Player, { nullable: true })
  @UseMiddleware(ResolvePlayer("playerId", false, { nullable: true }))
  async playerFromId(
    @Arg("playerId") playerId: string,
    @Ctx() { resolved }: Context
  ): Promise<VrplPlayer | null> {
    return resolved.player!;
  }

  @Query((_returns) => [String])
  @UseMiddleware(Authenticate([], [Permissions.Server]))
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

  @FieldResolver()
  @UseMiddleware(Authenticate(["player.discordId:read"]))
  discordId(@Root() vrplPlayer: VrplPlayer, @Ctx() { auth }: Context) {
    if (!auth) throw new UnauthorizedError();
    else if (
      auth.playerId !== vrplPlayer.id &&
      !userHasOneOfPermissions(auth, [
        Permissions.ManagePlayers,
        Permissions.AccessDiscordId,
      ])
    )
      throw new ForbiddenError();
    return vrplPlayer.discordId;
  }

  @Query((_returns) => Player, { nullable: true })
  @UseMiddleware(Authenticate([]))
  async findPlayer(
    @Arg("search") search: string,
    @Ctx() { auth }: Context
  ): Promise<VrplPlayer | null> {
    if (!auth) throw new UnauthorizedError();

    return await findPlayerBroadly(search);
  }

  @FieldResolver()
  @UseMiddleware(Authenticate(["player.email:read"]))
  email(
    @Root() vrplPlayer: VrplPlayer,
    @Ctx() { auth }: Context
  ): VrplPlayer["email"] {
    if (!auth) throw new UnauthorizedError();
    else if (auth.playerId !== vrplPlayer.id)
      auth.assurePerm(Permissions.Admin);
    return vrplPlayer.email;
  }

  @Mutation((_returns) => Player)
  @UseMiddleware(Authenticate(["USE_PERMISSIONS"], [Permissions.ManageBadges]))
  async addBadgeToPlayer(
    @Arg("playerId") playerId: string,
    @Arg("bitPosition", (_type) => Int) bitPosition: number,
    @Ctx() { auth }: Context
  ): Promise<VrplPlayer> {
    if (!auth) throw new InternalServerError("No user found in context");
    const vrplPlayer = await getPlayerFromId(playerId);
    if (!vrplPlayer) throw new BadRequestError("Player not found");
    const playerBadges = vrplPlayer.badgeField;
    const badge = await getBadgeFromBitPosition(bitPosition);
    if (!badge) throw new BadRequestError("No badge found with that position");
    const newBadgeBitField = playerBadges | (1 << bitPosition);
    return await updatePlayerBadges(vrplPlayer, newBadgeBitField, auth);
  }

  @Mutation((_returns) => Player)
  @UseMiddleware(Authenticate(["USE_PERMISSIONS"], [Permissions.ManageBadges]))
  async removeBadgeFromPlayer(
    @Arg("playerId") playerId: string,
    @Arg("bitPosition", (_type) => Int) bitPosition: number,
    @Ctx() { auth }: Context
  ): Promise<VrplPlayer> {
    if (!auth) throw new InternalServerError("No user found in context");
    const vrplPlayer = await getPlayerFromId(playerId);
    if (!vrplPlayer) throw new BadRequestError("Player not found");
    const playerBadges = vrplPlayer.badgeField;
    const badge = await getBadgeFromBitPosition(bitPosition);
    if (!badge) throw new BadRequestError("No badge found with that position");
    const newBadgeBitField = playerBadges & ~(1 << bitPosition);
    if (newBadgeBitField === playerBadges)
      throw new BadRequestError("Player doesn't have this badge");
    return await updatePlayerBadges(vrplPlayer, newBadgeBitField, auth);
  }

  @Mutation((_returns) => Player)
  @UseMiddleware(Authenticate(["USE_PERMISSIONS"], [Permissions.ManageBadges]))
  async setBadgesOfPlayer(
    @Arg("playerId") playerId: string,
    @Arg("bitField", (_type) => Int) bitField: number,
    @Ctx() { auth }: Context
  ): Promise<VrplPlayer> {
    if (!auth) throw new InternalServerError("No user found in context");
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
    return await updatePlayerBadges(vrplPlayer, bitField, auth);
  }

  @Mutation((_returns) => Player)
  @UseMiddleware(Authenticate(["player.nickname:write"]))
  @UseMiddleware(ResolvePlayer("playerId", true))
  async changePlayerName(
    @Arg("playerId") playerId: string,
    @Arg("newName") newName: string,
    @Ctx() { auth, resolved }: Context
  ) {
    const vrplPlayer = resolved.player!;
    auth = auth!;
    if (vrplPlayer.nickname.trim() === newName.trim())
      throw new BadRequestError("New nickname the same as the old one!");
    const foundPlayer = await getPlayerFromNickname(
      newName.trim(),
      vrplPlayer.id
    );
    if (foundPlayer)
      throw new BadRequestError("A player with that name already exists.");
    if (vrplPlayer.id !== auth.playerId)
      auth.assurePerm(Permissions.ManagePlayers);
    else {
      const hasCooldown = await getPlayerCooldownExpiresAt(
        vrplPlayer.id,
        "changeNickname"
      );
      if (hasCooldown)
        throw new ForbiddenError(
          `You are on a cooldown until ${hasCooldown.toString()}`
        );
    }
    const newPlayer = await updatePlayerName(vrplPlayer, newName, auth);
    if (!auth.hasPerm(Permissions.ManagePlayers))
      await addCooldownToPlayer(playerId, "changeNickname");
    return newPlayer;
  }

  @Mutation((_returns) => Player)
  @UseMiddleware(Authenticate(["player.region:write"]))
  @UseMiddleware(ResolvePlayer("playerId", true))
  async setPlayerRegion(
    @Arg("playerId") playerId: string,
    @Arg("region") region: string,
    @Ctx() { auth, resolved }: Context
  ) {
    const player = resolved.player!;
    auth = auth!;
    if (!Object.keys(VrplRegion).includes(region))
      throw new BadRequestError(
        `Invalid region, options are: ${Object.keys(VrplRegion).join(", ")} `
      );
    return await setPlayerRegion(player, region as VrplRegion, auth);
  }

  @Mutation((_returns) => Player)
  @UseMiddleware(Authenticate(["player.email:write"]))
  @UseMiddleware(ResolvePlayer("playerId", true))
  async updateEmail(
    @Arg("playerId") playerId: string,
    @Arg("email") email: string,
    @Ctx() { auth, resolved }: Context
  ) {
    const player = resolved.player!;
    auth = auth!;
    const validEmail = await validateEmail(email);
    if (!validEmail) throw new BadRequestError("Invalid email address");
    return await updatePlayerEmail(player, email, auth);
  }

  @Mutation((_returns) => Player)
  @UseMiddleware(Authenticate(["player.discordInfo:write"]))
  @UseMiddleware(ResolvePlayer("playerId", true))
  async refreshDiscordData(
    @Arg("playerId") playerId: string,
    @Ctx() { auth, resolved }: Context
  ): Promise<VrplPlayer> {
    const player = resolved.player!;
    return await refreshDiscordData(player);
  }

  @Mutation((_returns) => Player)
  @UseMiddleware(Authenticate(["player.about:write"]))
  @UseMiddleware(ResolvePlayer("playerId", true))
  async changePlayerAbout(
    @Arg("playerId") playerId: string,
    @Arg("about") about: string,
    @Ctx() { auth, resolved }: Context
  ) {
    const player = resolved.player!;
    auth = auth!;
    if (about.length > 1500)
      throw new BadRequestError(
        "About text can't be longer than 1500 characters"
      );

    return await updatePlayerAbout(player, about, auth);
  }

  @Mutation((_returns) => Boolean)
  @UseMiddleware(Authenticate(["USE_PERMISSIONS"], [Permissions.ManagePlayers]))
  async revalidatePlayerPages(
    @Arg("playerIds", (_type) => [String]) playerIds: [string]
  ) {
    await revalidatePlayerPages(playerIds);
    return true;
  }
}
