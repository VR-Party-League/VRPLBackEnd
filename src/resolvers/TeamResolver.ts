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
} from "../db/team";
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
} from "../utils/errors";
import { Permissions, userHasPermission } from "../utils/permissions";
import Team from "../schemas/Team";
import { VrplTournament } from "../db/models/vrplTournaments";
import { getTournamentFromId } from "../db/tournaments";
import { getAvatar } from "../utils/storage";

@Resolver((_of) => Team)
export default class {
  @Query((_returns) => Team, { nullable: true })
  teamFromName(
    @Arg("tournamentId") tournamentId: string,
    @Arg("name") name: string
  ): Promise<VrplTeam | null> {
    return getTeamFromName(tournamentId, name);
  }
  @Query((_returns) => Team, { nullable: true })
  teamFromId(
    @Arg("tournamentId") tournamentId: string,
    @Arg("id") id: string
  ): Promise<VrplTeam | null> {
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
    if (!createdTeamRes.success)
      throw new BadRequestError(`${createdTeamRes.error}`);

    if (makeCaptain) {
      await addPlayerToTeam(
        tournamentId,
        createdTeamRes.doc,
        ownerId,
        VrplTeamPlayerRole.Captain,
        ctx.user.id
      );
    }

    return Object.assign(new Team(), createdTeamRes.doc);
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
    return Object.assign(new Team(), newTeam);
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
    return Object.assign(new Team(), newTeam);
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
    return Object.assign(new Team(), newTeam);
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
    if (!ctx.user) throw new BadRequestError("Not logged in");
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
    return Object.assign(new Team(), res);
  }
}
