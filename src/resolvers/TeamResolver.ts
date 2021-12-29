import {
  Arg,
  Authorized,
  Ctx,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { Context } from "..";
import vrplPlayer, { VrplPlayer } from "../db/models/vrplPlayer";
import { VrplTeam, VrplTeamPlayerRole } from "../db/models/vrplTeam";
import { getPlayerFromId } from "../db/player";
import {
  addPlayerToTeam,
  changeTeamPlayerRole,
  createTeam,
  getTeamFromId,
  getTeamFromName,
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
import {
  getTournamentFromId,
  getTournamentIdFromName,
} from "../db/tournaments";
import { getAvatar } from "../utils/storage";

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
    const tournamentId = await getTournamentIdFromName(tournamentName);
    if (!tournamentId) throw new BadRequestError("Invalid tournament name");
    return getTeamFromName(tournamentId, name);
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

  // TODO: Slightly tested
  @Authorized()
  @Mutation((_returns) => Team)
  async createTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamName") teamName: string,
    @Arg("ownerId") ownerId: string,
    @Arg("makeCaptain", { nullable: true }) makeCaptain: boolean,
    @Ctx() ctx: Context
  ): Promise<Team> {
    if (!ctx.user) throw new BadRequestError("Not logged in");
    const createdTeamRes = await createTeam(
      tournamentId,
      teamName,
      ownerId,
      ctx.user.id
    );

    if (makeCaptain) {
      await addPlayerToTeam(
        tournamentId,
        createdTeamRes,
        ownerId,
        VrplTeamPlayerRole.Captain,
        ctx.user.id
      );
    }

    return Object.assign(new Team(), createdTeamRes);
  }

  // TODO: Untested
  @Authorized()
  @Mutation((_returns) => Team)
  async addPlayerToTeamAsPlayer(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("playerId") playerId: string,
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
    const newTeam = await addPlayerToTeam(
      tournamentId,
      originalTeam,
      playerId,
      VrplTeamPlayerRole.Player,
      ctx.user.id
    );
    if (!newTeam) throw new InternalServerError(`Failed to add player to team`);
    return newTeam;
  }
  // TODO: Untested
  @Authorized()
  @Mutation((_returns) => Team)
  async addPlayerToTeamAsSub(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("playerId") playerId: string,
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
    const newTeam = await addPlayerToTeam(
      tournamentId,
      originalTeam,
      playerId,
      VrplTeamPlayerRole.Sub,
      ctx.user.id
    );

    if (!newTeam) throw new InternalServerError(`Failed to add sub to team`);
    return newTeam;
  }

  // TODO: Untested
  @Authorized()
  @Mutation((_returns) => Team)
  async changePlayerRole(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("playerId") playerId: string,
    @Arg("role", (type) => Number) role: VrplTeamPlayerRole,
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
    @Arg("addAsPlayer", { nullable: true }) addAsPlayer: boolean,
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
    if (!ctx.user) throw new BadRequestError("Not logged in");
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
}
