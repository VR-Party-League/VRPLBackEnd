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
import Player from "../schemas/Player";
import Team from "../schemas/Team";

@Resolver((of) => Player)
export default class {
  // @Query((returns) => Team, { nullable: true })
  // teamFromName(
  //   @Arg("tournamentId") tournamentId: string,
  //   @Arg("name") name: string
  // ): Promise<VrplTeam | null> {
  //   return getTeamFromName(tournamentId, name);
  // }
  // @Query((returns) => Team, { nullable: true })
  // teamFromId(
  //   @Arg("tournamentId") tournamentId: string,
  //   @Arg("id") id: string
  // ): Promise<VrplTeam | null> {
  //   return getTeamFromId(tournamentId, id);
  // }
}
