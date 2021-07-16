import {
  Arg,
  Authorized,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { projects, tasks, ProjectData } from "../data";
import { VrplPlayer } from "../db/models/vrplPlayer";
import { VrplTeam } from "../db/models/vrplTeam";
import { getPlayerFromId } from "../db/player";
import { createTeam, getTeamFromId, getTeamFromName } from "../db/team";
import { BadRequestError } from "../errors";
import Team from "../schemas/Team";

@Resolver((of) => Team)
export default class {
  @Query((returns) => Team, { nullable: true })
  teamFromName(
    @Arg("tournamentId") tournamentId: string,
    @Arg("name") name: string
  ): Promise<VrplTeam | null> {
    return getTeamFromName(tournamentId, name);
  }
  @Query((returns) => Team, { nullable: true })
  teamFromId(
    @Arg("tournamentId") tournamentId: string,
    @Arg("id") id: string
  ): Promise<VrplTeam | null> {
    return getTeamFromId(tournamentId, id);
  }

  @FieldResolver()
  async owner(@Root() vrplTeam: VrplTeam): Promise<VrplPlayer> {
    console.log(vrplTeam.ownerId);
    return (await getPlayerFromId(vrplTeam.ownerId))!;
  }
  // @FieldResolver()
  // teamPlayers(@Root() vrplTeam: VrplTeam): Promise<(VrplPlayer | null)[]> {
  //   return Promise.all(vrplTeam.teamPlayers.map((id) => getPlayerFromId(id)));
  // }

  @Authorized()
  @Mutation((returns) => Team)
  async createTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamName") teamName: string,
    @Arg("captainId") captainId: string
  ): Promise<Team> {
    const res = await createTeam(tournamentId, teamName, captainId);
    console.log(res);
    if (res.success) return Object.assign(new Team(), res.doc);
    throw new BadRequestError(`${res.error}`);
  }
}
