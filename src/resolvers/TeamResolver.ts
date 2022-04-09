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
import { VrplPlayer } from "../db/models/vrplPlayer";
import {
  SocialPlatform,
  supportedSocialPlatforms,
  VrplTeam,
  VrplTeamPlayerRole,
} from "../db/models/vrplTeam";
import { getPlayerFromId, getPlayersFromIds } from "../db/player";
import {
  addSocialAccountToTeam,
  changeTeamPlayerRole,
  clearTeamSeed,
  deleteTeam,
  getTeamFromId,
  getTeamFromName,
  invitePlayersToTeam,
  removePlayersFromTeam,
  removeSocialAccountFromTeam,
  setTeamSeed,
  transferTeam,
  updateTeamName,
} from "../db/team";
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  UnauthorizedError,
} from "../utils/errors";
import { Permissions, userHasPermission } from "../utils/permissions";
import Team from "../schemas/Team";
import { VrplTournament } from "../db/models/vrplTournaments";
import { getTournamentFromId, getTournamentFromName } from "../db/tournaments";
import { getAvatar } from "../utils/storage";
import { getMatchesForTeam } from "../db/match";
import Match from "../schemas/Match";

@Resolver((_of) => Team)
export default class {
  @Query((_returns) => Team, { nullable: true })
  async teamFromName(
    @Arg("name") name: string,
    @Arg("tournamentName", { nullable: true }) tournamentName?: string,
    @Arg("tournamentId", { nullable: true }) enteredTournamentId?: string
  ): Promise<VrplTeam | null> {
    if (enteredTournamentId) {
      return getTeamFromName(enteredTournamentId, name);
    } else if (!tournamentName)
      throw new BadRequestError("Must enter tournament name or id");
    const tournament = await getTournamentFromName(tournamentName);
    if (!tournament) throw new BadRequestError("Invalid tournament name");
    return getTeamFromName(tournament.id, name);
  }

  @Query((_returns) => Team, { nullable: true })
  async teamFromId(
    @Arg("id") id: string,
    @Arg("tournamentName", { nullable: true }) tournamentName?: string,
    @Arg("tournamentId", { nullable: true }) enteredTournamentId?: string
  ): Promise<VrplTeam | null> {
    if (enteredTournamentId) {
      return getTeamFromId(enteredTournamentId, id);
    } else if (!tournamentName)
      throw new BadRequestError("Must enter tournament name or id");
    const tournament = await getTournamentFromName(tournamentName);
    if (!tournament) throw new BadRequestError("Invalid tournament name");
    return await getTeamFromId(tournament.id, id);
  }

  @FieldResolver()
  async owner(@Root() vrplTeam: VrplTeam): Promise<VrplPlayer> {
    return (await getPlayerFromId(vrplTeam.ownerId))!;
  }

  @FieldResolver()
  async tournament(@Root() vrplTeam: VrplTeam): Promise<VrplTournament> {
    return (await getTournamentFromId(vrplTeam.tournamentId))!;
  }

  @FieldResolver()
  async avatar(@Root() vrplTeam: VrplTeam): Promise<string | undefined> {
    return await getAvatar("team", vrplTeam.id, vrplTeam.tournamentId);
  }

  @FieldResolver((_returns) => [Match])
  async matches(@Root() vrplTeam: VrplTeam) {
    return await getMatchesForTeam(vrplTeam.tournamentId, vrplTeam.id, true);
  }

  // TODO: Untested
  @Authorized()
  @Mutation((_returns) => Team)
  async invitePlayersToTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("playerIds", (_type) => [String]) playerIds: string[],
    @Ctx() ctx: Context
  ) {
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();
    const originalTeam = await getTeamFromId(tournamentId, teamId);
    if (!originalTeam) throw new BadRequestError("Team not found");
    else if (
      originalTeam.ownerId !== user.id &&
      !userHasPermission(user, Permissions.ManageTeams)
    )
      throw new ForbiddenError();
    const players = await getPlayersFromIds(playerIds);
    if (!players?.[0]) throw new BadRequestError("No players found");
    else if (players.length !== playerIds.length)
      throw new BadRequestError("Some players not found");

    const newTeam = invitePlayersToTeam(
      originalTeam,
      playerIds,
      VrplTeamPlayerRole.Player,
      user
    );

    if (!newTeam) throw new InternalServerError(`Failed to add player to team`);
    return newTeam;
  }

  // TODO: Untested
  @Authorized()
  @Mutation((_returns) => Team)
  async changePlayerRole(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("playerId") playerId: string,
    @Arg("role", (_type) => Number) role: VrplTeamPlayerRole,
    @Ctx() ctx: Context
  ) {
    if (!ctx.user) throw new BadRequestError("Not logged in");
    const originalTeam = await getTeamFromId(tournamentId, teamId);
    if (!originalTeam) throw new BadRequestError("Team not found");
    else if (
      originalTeam.ownerId !== ctx.user.id &&
      !userHasPermission(ctx.user, Permissions.ManageTeams)
    )
      throw new ForbiddenError();

    if (!Object.values(VrplTeamPlayerRole).includes(role))
      throw new BadRequestError(
        `Invalid team player role\nValid roles: "${Object.values(
          VrplTeamPlayerRole
        ).join('", "')}"`
      );

    const newTeam = await changeTeamPlayerRole(
      originalTeam,
      playerId,
      role,
      ctx.user.id
    );
    if (!newTeam) throw new InternalServerError(`Failed to add sub to team`);
    return newTeam;
  }

  // TODO: Untested
  @Authorized()
  @Mutation((_returns) => Team)
  async transferTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("playerId") playerId: string,
    @Arg("makeOldOwnerPlayer", { nullable: true }) makeOldOwnerPlayer: boolean,
    @Ctx() ctx: Context
  ) {
    if (!ctx.user) throw new UnauthorizedError("Not logged in");
    const originalTeam = await getTeamFromId(tournamentId, teamId);
    if (!originalTeam) throw new BadRequestError("Team not found");

    if (
      originalTeam.ownerId !== ctx.user.id &&
      !userHasPermission(ctx.user, Permissions.ManageTeams)
    )
      throw new ForbiddenError();

    const res = transferTeam(
      originalTeam,
      playerId,
      ctx.user.id,
      makeOldOwnerPlayer ? VrplTeamPlayerRole.Player : undefined
    );
    if (!res) throw new InternalServerError("Failed to transfer teams");
    return res;
  }

  @Authorized()
  @Mutation((_returns) => Team)
  async changeTeamName(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("newName") newName: string,
    @Ctx() ctx: Context
  ): Promise<VrplTeam> {
    if (!ctx.user) throw new UnauthorizedError();
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new BadRequestError("Team not found");
    else if (
      team.ownerId !== ctx.user.id &&
      !userHasPermission(ctx.user, Permissions.ManageTeams)
    )
      throw new ForbiddenError();
    const res = await updateTeamName(team.toObject(), newName, ctx.user.id);

    if (!res) throw new InternalServerError("Failed to change team name");
    return res;
  }

  @Authorized()
  @Mutation((_returns) => Team)
  async removePlayersFromTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("playerIds", (_type) => [String]) playerIds: string[],
    @Ctx() ctx: Context
  ) {
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new BadRequestError("Team not found");
    else if (
      team.ownerId !== user.id &&
      !userHasPermission(user, Permissions.ManageTeams)
    )
      throw new ForbiddenError();
    else if (
      playerIds.find(
        (id) =>
          !team.teamPlayers.find((teamPlayer) => teamPlayer.playerId === id)
      )
    )
      throw new BadRequestError(
        "Some of the players that should be removed are not on the team"
      );
    const res = await removePlayersFromTeam(team, playerIds, user.id);
    if (!res)
      throw new InternalServerError("Failed to remove players from team");
    return res;
  }

  @Authorized()
  @Mutation((_returns) => Team)
  async deleteTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("force", { nullable: true }) force: boolean,
    @Ctx() ctx: Context
  ) {
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();
    else if (force && !userHasPermission(user, Permissions.ManageTeams))
      throw new ForbiddenError();
    const [team, tournament] = await Promise.all([
      getTeamFromId(tournamentId, teamId),
      getTournamentFromId(tournamentId),
    ]);
    if (!tournament) throw new BadRequestError("Tournament not found");
    else if (!team) throw new BadRequestError("Team not found");
    else if (
      team.ownerId !== user.id &&
      !userHasPermission(user, Permissions.ManageTeams)
    )
      throw new ForbiddenError();
    else if (!force && tournament.registrationStart > new Date())
      throw new BadRequestError("Cannot delete team before registration start");
    else if (!force && tournament.registrationEnd < new Date())
      throw new BadRequestError("Cannot delete team after registration end");
    const res = await deleteTeam(tournament, team.id, user.id);
    if (!res) throw new InternalServerError("Failed to remove team");
    return res;
  }

  @Authorized()
  @Mutation((_returns) => Team)
  async setSocialAccountForTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("platform", (_type) => String) platform: SocialPlatform,
    @Arg("code") code: string,
    @Ctx() ctx: Context
  ) {
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new BadRequestError("Team not found");
    else if (
      team.ownerId !== user.id &&
      !userHasPermission(user, Permissions.ManageTeams)
    )
      throw new ForbiddenError();
    else if (!supportedSocialPlatforms.includes(platform))
      throw new BadRequestError(
        "Invalid platform, platforms supported: " +
          supportedSocialPlatforms.join(", ")
      );
    const res = await addSocialAccountToTeam(team, platform, code, user.id);
    if (!res)
      throw new InternalServerError("Failed to add social account to team");
    return res;
  }

  @Authorized()
  @Mutation((_returns) => Team)
  async removeSocialAccountFromTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("platform", (_type) => String) platform: SocialPlatform,
    @Ctx() ctx: Context
  ) {
    const { user } = ctx;
    if (!user) throw new UnauthorizedError();
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new BadRequestError("Team not found");
    else if (
      team.ownerId !== user.id &&
      !userHasPermission(user, Permissions.ManageTeams)
    )
      throw new ForbiddenError();
    else if (!supportedSocialPlatforms.includes(platform))
      throw new BadRequestError(
        "Invalid platform, platforms supported: " +
          supportedSocialPlatforms.join(", ")
      );
    const res = await removeSocialAccountFromTeam(team, platform, user.id);
    if (!res)
      throw new InternalServerError(
        "Failed to remove social account from team"
      );
    return res;
  }

  @Authorized([Permissions.ManageTournaments])
  @Mutation((_returns) => Team)
  async setTeamSeed(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("seed", (_type) => Int) seed: number,
    @Ctx() ctx: Context
  ) {
    const { user } = ctx;
    if (!user) throw new UnauthorizedError();
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new BadRequestError("Team not found");
    return setTeamSeed(team, seed, user.id);
  }

  @Authorized([Permissions.ManageTournaments])
  @Mutation((_returns) => Team)
  async clearTeamSeed(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Ctx() ctx: Context
  ) {
    const { user } = ctx;
    if (!user) throw new UnauthorizedError();
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new BadRequestError("Team not found");
    return clearTeamSeed(team, user.id);
  }
}
