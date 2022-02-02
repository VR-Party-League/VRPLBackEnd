import {Arg, Authorized, Ctx, FieldResolver, Mutation, Query, Resolver, Root,} from "type-graphql";
import {Context} from "..";
import {VrplPlayer} from "../db/models/vrplPlayer";
import {VrplTeam, VrplTeamPlayerRole} from "../db/models/vrplTeam";
import {getPlayerFromId, getPlayersFromIds} from "../db/player";
import {
  changeTeamPlayerRole,
  deleteTeam,
  getTeamFromId,
  getTeamFromName,
  invitePlayersToTeam,
  removePlayersFromTeam,
  transferTeam,
  updateTeamName,
} from "../db/team";
import {BadRequestError, ForbiddenError, InternalServerError, UnauthorizedError,} from "../utils/errors";
import {Permissions, userHasPermission} from "../utils/permissions";
import Team from "../schemas/Team";
import {VrplTournament} from "../db/models/vrplTournaments";
import {getTournamentFromId, getTournamentIdFromName,} from "../db/tournaments";
import {getAvatar} from "../utils/storage";
import {getMatchesForTeam} from "../db/match";
import Match from "../schemas/Match";

@Resolver((_of) => Team)
export default class {
  @Query((_returns) => Team, {nullable: true})
  async teamFromName(
    @Arg("name") name: string,
    @Arg("tournamentName", {nullable: true}) tournamentName?: string,
    @Arg("tournamentId", {nullable: true}) enteredTournamentId?: string
  ): Promise<VrplTeam | null> {
    if (enteredTournamentId) {
      return getTeamFromName(enteredTournamentId, name);
    } else if (!tournamentName)
      throw new BadRequestError("Must enter tournament name or id");
    const tournamentId = await getTournamentIdFromName(tournamentName);
    if (!tournamentId) throw new BadRequestError("Invalid tournament name");
    return getTeamFromName(tournamentId, name);
  }
  
  @Query((_returns) => Team, {nullable: true})
  async teamFromId(
    @Arg("id") id: string,
    @Arg("tournamentName", {nullable: true}) tournamentName?: string,
    @Arg("tournamentId", {nullable: true}) enteredTournamentId?: string
  ): Promise<VrplTeam | null> {
    if (enteredTournamentId) {
      return getTeamFromId(enteredTournamentId, id);
    } else if (!tournamentName)
      throw new BadRequestError("Must enter tournament name or id");
    const tournamentId = await getTournamentIdFromName(tournamentName);
    if (!tournamentId) throw new BadRequestError("Invalid tournament name");
    return getTeamFromId(tournamentId, id);
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
  avatar(@Root() vrplTeam: VrplTeam): Promise<string | undefined> {
    return getAvatar("team", vrplTeam.id, vrplTeam.tournamentId);
  }
  
  @FieldResolver((_returns) => [Match])
  async matches(@Root() vrplTeam: VrplTeam) {
    const matches = await getMatchesForTeam(
      vrplTeam.tournamentId,
      vrplTeam.id,
      true
    );
    return matches;
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
      tournamentId,
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
    @Arg("addAsPlayer", {nullable: true}) addAsPlayer: boolean,
    @Ctx() ctx: Context
  ) {
    if (!ctx.user) throw new UnauthorizedError("Not logged in");
    const originalTeam = await getTeamFromId(tournamentId, teamId);
    if (!originalTeam) throw new BadRequestError("Team not found");
    else if (
      originalTeam.ownerId !== ctx.user.id &&
      !userHasPermission(ctx.user, Permissions.ManageTeams)
    )
      throw new ForbiddenError();
    
    const res = transferTeam(
      tournamentId,
      originalTeam,
      playerId,
      ctx.user.id,
      addAsPlayer ? VrplTeamPlayerRole.Player : undefined
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
    const [team, tournament] = await Promise.all([
      getTeamFromId(tournamentId, teamId),
      getTournamentFromId(tournamentId),
    ]);
    if (!team) throw new BadRequestError("Team not found");
    else if (!tournament) throw new BadRequestError("Tournament not found");
    else if (
      team.ownerId !== ctx.user.id &&
      !userHasPermission(ctx.user, Permissions.ManageTeams)
    )
      throw new ForbiddenError();
    const res = await updateTeamName(
      team.toObject(),
      tournament,
      newName,
      ctx.user.id
    );
    
    if (!res) throw new InternalServerError("Failed to change team name");
    console.log("res", res);
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
    else if (team.ownerId !== user.id && !userHasPermission(user, Permissions.ManageTeams))
      throw new ForbiddenError();
    else if (playerIds.find((id) => !team.teamPlayers.find(teamPlayer => teamPlayer.playerId === id)))
      throw new BadRequestError("Some of the players that should be removed are not on the team")
    const res = await removePlayersFromTeam(
      team,
      playerIds,
      user.id
    );
    if (!res) throw new InternalServerError("Failed to remove players from team");
    return res;
  }
  
  @Authorized()
  @Mutation((_returns) => Team)
  async deleteTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Ctx() ctx: Context
  ) {
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();
    const [team, tournament] = await Promise.all([getTeamFromId(tournamentId, teamId), getTournamentFromId(tournamentId)]);
    if (!tournament) throw new BadRequestError("Tournament not found");
    else if (!team) throw new BadRequestError("Team not found");
    else if (team.ownerId !== user.id && !userHasPermission(user, Permissions.ManageTeams))
      throw new ForbiddenError();
    else if (tournament.registrationStart > new Date())
      throw new BadRequestError("Cannot delete team before registration start");
    else if (tournament.registrationEnd < new Date())
      throw new BadRequestError("Cannot delete team after registration end");
    const res = await deleteTeam(tournamentId, team.id, user.id);
    if (!res) throw new InternalServerError("Failed to remove team");
    return res;
  }
  
}
