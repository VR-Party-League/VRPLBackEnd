import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
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
  InternalServerError,
  UnauthorizedError,
} from "../utils/errors";
import { Authenticate, Permissions } from "../utils/permissions";
import Team from "../schemas/Team";
import { VrplTournament } from "../db/models/vrplTournaments";
import { getTournamentFromId, getTournamentFromSlug } from "../db/tournaments";
import { getAvatar } from "../utils/storage";
import { getMatchesForTeam } from "../db/match";
import Match from "../schemas/Match";
import { VrplTeamCooldown } from "../db/models/cooldowns";
import { getTeamCooldowns } from "../db/cooldown";
import { revalidateTeamPages } from "../db/records";

@Resolver((_of) => Team)
export default class {
  @Query((_returns) => Team, { nullable: true })
  async teamFromName(
    @Arg("name") name: string,
    @Arg("tournamentSlug", { nullable: true }) tournamentSlug?: string,
    @Arg("tournamentId", { nullable: true }) enteredTournamentId?: string
  ): Promise<VrplTeam | null> {
    if (enteredTournamentId) {
      return getTeamFromName(enteredTournamentId, name);
    } else if (!tournamentSlug)
      throw new BadRequestError("Must enter tournament slug or id");
    const tournament = await getTournamentFromSlug(tournamentSlug);
    if (!tournament) throw new BadRequestError("Invalid tournament name");
    return getTeamFromName(tournament.id, name);
  }

  @Query((_returns) => Team, { nullable: true })
  async teamFromId(
    @Arg("id") id: string,
    @Arg("tournamentSlug", { nullable: true }) tournamentSlug?: string,
    @Arg("tournamentId", { nullable: true }) enteredTournamentId?: string
  ): Promise<VrplTeam | null> {
    if (enteredTournamentId) {
      return getTeamFromId(enteredTournamentId, id);
    } else if (!tournamentSlug)
      throw new BadRequestError("Must enter tournament slug or id");
    const tournament = await getTournamentFromSlug(tournamentSlug);
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
    if (!vrplTeam.avatarHash) return undefined;
    return await getAvatar(
      "team",
      vrplTeam.id,
      vrplTeam.avatarHash,
      vrplTeam.tournamentId
    );
  }

  @FieldResolver((_returns) => [Match])
  async matches(@Root() vrplTeam: VrplTeam) {
    if (vrplTeam.seed === undefined) return [];
    return await getMatchesForTeam(vrplTeam.tournamentId, vrplTeam.seed);
  }

  @FieldResolver()
  cooldowns(@Root() vrplTeam: VrplTeam): Promise<VrplTeamCooldown[]> {
    return getTeamCooldowns(vrplTeam.id, vrplTeam.tournamentId);
  }

  // TODO: Untested
  @Mutation((_returns) => Team)
  @UseMiddleware(Authenticate(["team.teamPlayers:write"]))
  async invitePlayersToTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("playerIds", (_type) => [String]) playerIds: string[],
    @Ctx() { auth }: Context
  ) {
    if (!auth) throw new UnauthorizedError();
    else if (!auth.playerId)
      throw new BadRequestError("Need player to send request");
    const originalTeam = await getTeamFromId(tournamentId, teamId);
    if (!originalTeam) throw new BadRequestError("Team not found");
    else if (originalTeam.ownerId !== auth.playerId)
      auth.assurePerm(Permissions.ManageTeams);
    const players = await getPlayersFromIds(playerIds);
    if (!players?.[0]) throw new BadRequestError("No players found");
    else if (players.length !== playerIds.length)
      throw new BadRequestError("Some players not found");

    const newTeam = invitePlayersToTeam(
      originalTeam,
      playerIds,
      VrplTeamPlayerRole.Player,
      auth
    );

    if (!newTeam) throw new InternalServerError(`Failed to add player to team`);
    return newTeam;
  }

  // TODO: Untested
  @Mutation((_returns) => Team)
  @UseMiddleware(Authenticate(["team.teamPlayers:write"]))
  async changePlayerRole(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("playerId") playerId: string,
    @Arg("role", (_type) => Number) role: VrplTeamPlayerRole,
    @Ctx() { auth }: Context
  ) {
    if (!auth) throw new UnauthorizedError();
    const originalTeam = await getTeamFromId(tournamentId, teamId);
    if (!originalTeam) throw new BadRequestError("Team not found");
    else if (originalTeam.ownerId !== auth.playerId)
      auth.assurePerm(Permissions.ManageTeams);

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
      auth
    );
    if (!newTeam) throw new InternalServerError(`Failed to add sub to team`);
    return newTeam;
  }

  // TODO: Untested
  @Mutation((_returns) => Team)
  @UseMiddleware(Authenticate(["team.owner:write"]))
  async transferTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("playerId") playerId: string,
    @Arg("makeOldOwnerPlayer", { nullable: true }) makeOldOwnerPlayer: boolean,
    @Ctx() { auth }: Context
  ) {
    if (!auth) throw new UnauthorizedError("Not logged in");
    const originalTeam = await getTeamFromId(tournamentId, teamId);
    if (!originalTeam) throw new BadRequestError("Team not found");

    if (originalTeam.ownerId !== auth.playerId)
      auth.assurePerm(Permissions.ManageTeams);

    const res = transferTeam(
      originalTeam,
      playerId,
      auth,
      makeOldOwnerPlayer ? VrplTeamPlayerRole.Player : undefined
    );
    if (!res) throw new InternalServerError("Failed to transfer teams");
    return res;
  }

  @Mutation((_returns) => Team)
  @UseMiddleware(Authenticate(["team.name:write"]))
  async changeTeamName(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("newName") newName: string,
    @Ctx() { auth }: Context
  ): Promise<VrplTeam> {
    if (!auth) throw new UnauthorizedError();
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new BadRequestError("Team not found");
    else if (team.ownerId !== auth.playerId)
      auth.assurePerm(Permissions.ManageTeams);

    const teamObj = team.toJSON<VrplTeam>();
    const res = await updateTeamName(teamObj, newName, auth);
    if (!res) throw new InternalServerError("Failed to change team name");
    return res;
  }

  @Mutation((_returns) => Team)
  @UseMiddleware(Authenticate(["team.teamPlayers:write"]))
  async removePlayersFromTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("playerIds", (_type) => [String]) playerIds: string[],
    @Ctx() { auth }: Context
  ) {
    if (!auth) throw new UnauthorizedError();
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new BadRequestError("Team not found");
    else if (team.ownerId !== auth.playerId)
      auth.assurePerm(Permissions.ManageTeams);
    else if (
      playerIds.find(
        (id) =>
          !team.teamPlayers.find((teamPlayer) => teamPlayer.playerId === id)
      )
    )
      throw new BadRequestError(
        "Some of the players that should be removed are not on the team"
      );
    const res = await removePlayersFromTeam(team, playerIds, auth);
    if (!res)
      throw new InternalServerError("Failed to remove players from team");
    return res;
  }

  @Mutation((_returns) => Team)
  @UseMiddleware(Authenticate(["team.owner:write"]))
  async deleteTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("force", { nullable: true }) force: boolean,
    @Ctx() { auth }: Context
  ) {
    if (!auth) throw new UnauthorizedError();
    else if (force) auth.assurePerm(Permissions.ManageTeams);
    const [team, tournament] = await Promise.all([
      getTeamFromId(tournamentId, teamId),
      getTournamentFromId(tournamentId),
    ]);
    if (!tournament) throw new BadRequestError("Tournament not found");
    else if (!team) throw new BadRequestError("Team not found");
    else if (team.ownerId !== auth.playerId)
      auth.assurePerm(Permissions.ManageTeams);
    else if (!force && tournament.registrationStart > new Date())
      throw new BadRequestError("Cannot delete team before registration start");
    else if (!force && tournament.registrationEnd < new Date())
      throw new BadRequestError("Cannot delete team after registration end");
    const res = await deleteTeam(tournament, team, auth);
    if (!res) throw new InternalServerError("Failed to remove team");
    return res;
  }

  @Mutation((_returns) => Team)
  @UseMiddleware(Authenticate(["team.socials:write"]))
  async setSocialAccountForTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("platform", (_type) => String) platform: SocialPlatform,
    @Arg("code") code: string,
    @Ctx() { auth }: Context
  ) {
    if (!auth) throw new UnauthorizedError();
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new BadRequestError("Team not found");
    else if (team.ownerId !== auth.playerId)
      auth.assurePerm(Permissions.ManageTeams);
    else if (!supportedSocialPlatforms.includes(platform))
      throw new BadRequestError(
        "Invalid platform, platforms supported: " +
          supportedSocialPlatforms.join(", ")
      );
    const res = await addSocialAccountToTeam(team, platform, code, auth);
    if (!res)
      throw new InternalServerError("Failed to add social account to team");
    return res;
  }

  @Mutation((_returns) => Team)
  @UseMiddleware(Authenticate(["team.socials:write"]))
  async removeSocialAccountFromTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("platform", (_type) => String) platform: SocialPlatform,
    @Ctx() { auth }: Context
  ) {
    if (!auth) throw new UnauthorizedError();
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new BadRequestError("Team not found");
    else if (team.ownerId !== auth.playerId)
      auth.assurePerm(Permissions.ManageTeams);
    else if (!supportedSocialPlatforms.includes(platform))
      throw new BadRequestError(
        "Invalid platform, platforms supported: " +
          supportedSocialPlatforms.join(", ")
      );
    const res = await removeSocialAccountFromTeam(team, platform, auth);
    if (!res)
      throw new InternalServerError(
        "Failed to remove social account from team"
      );
    return res;
  }

  @Mutation((_returns) => Team)
  @UseMiddleware(
    Authenticate(["USE_PERMISSIONS"], [Permissions.ManageTournaments])
  )
  async setTeamSeed(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("seed", (_type) => Int) seed: number,
    @Ctx() { auth }: Context
  ) {
    if (!auth) throw new UnauthorizedError();
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new BadRequestError("Team not found");
    return setTeamSeed(team, seed, auth);
  }

  @Mutation((_returns) => Team)
  @UseMiddleware(
    Authenticate(["USE_PERMISSIONS"], [Permissions.ManageTournaments])
  )
  async clearTeamSeed(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Ctx() { auth }: Context
  ) {
    if (!auth) throw new UnauthorizedError();
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new BadRequestError("Team not found");
    return clearTeamSeed(team, auth);
  }

  @Mutation((_returns) => Boolean)
  @UseMiddleware(Authenticate(["USE_PERMISSIONS"], [Permissions.ManageTeams]))
  async revalidateTeamPage(
    @Arg("teams", (_type) => [TeamsInput]) teams: TeamsInput[]
  ) {
    await revalidateTeamPages(teams);
    return true;
  }
}

@InputType("TeamsInput")
class TeamsInput {
  @Field((_type) => String)
  tournamentName: string;
  @Field((_type) => String)
  teamId: string;
}
