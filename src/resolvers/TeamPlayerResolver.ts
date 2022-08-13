import {
  Arg,
  Ctx,
  FieldResolver,
  Int,
  Mutation,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { VrplPlayer } from "../db/models/vrplPlayer";
import { VrplTeamPlayer, VrplTeamPlayerRole } from "../db/models/vrplTeam";
import { getPlayerFromId } from "../db/player";
import { TeamPlayer } from "../schemas/TeamPlayer";
import { Context } from "../index";
import { changeTeamPlayerRole, getTeamFromId } from "../db/team";
import { BadRequestError, InternalServerError } from "../utils/errors";
import { Authenticate, Permissions, ResolveTeam } from "../utils/permissions";

@Resolver((_of) => TeamPlayer)
export default class {
  @FieldResolver()
  async player(@Root() vrplTeamPlayer: VrplTeamPlayer): Promise<VrplPlayer> {
    return (await getPlayerFromId(vrplTeamPlayer.playerId))!;
  }

  @FieldResolver()
  roleId(@Root() vrplTeamPlayer: VrplTeamPlayer): number {
    return vrplTeamPlayer.role;
  }

  @FieldResolver()
  roleName(@Root() vrplTeamPlayer: VrplTeamPlayer): string {
    return VrplTeamPlayerRole[vrplTeamPlayer.role]!;
  }

  @Mutation((_returns) => TeamPlayer)
  @UseMiddleware(
    ResolveTeam(
      "teamId",
      "tournamentId",
      {
        ownerOf: true,
      },
      Permissions.ManageTeams
    )
  )
  @UseMiddleware(Authenticate(["team.teamPlayers:write"]))
  async changeTeamPlayerRole(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("playerId") playerId: string,
    @Arg("roleId", (_type) => Int) roleId: VrplTeamPlayerRole,
    @Ctx() { resolved: { team }, auth }: Context
  ): Promise<VrplTeamPlayer> {
    if (!team) throw new InternalServerError("Team not found");
    else if (!auth) throw new InternalServerError("Auth not found");
    if (!team.teamPlayers.some((p) => p.playerId === playerId))
      throw new BadRequestError("Player is not on the team");

    if (!Object.values(VrplTeamPlayerRole).includes(roleId))
      throw new BadRequestError(
        `Invalid roleId, options are: ${Object.values(VrplTeamPlayerRole)} `
      );
    else if (roleId === VrplTeamPlayerRole.Pending)
      throw new BadRequestError(
        "Pending is not a valid role to assign to a player"
      );
    const res = await changeTeamPlayerRole(team, playerId, roleId, auth);
    if (!res) throw new InternalServerError("Could not change role");
    return res.teamPlayers.find((p) => p.playerId === playerId)!;
  }
}
