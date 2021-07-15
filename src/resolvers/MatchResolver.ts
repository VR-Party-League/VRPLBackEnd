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
import { VrplMatch } from "../db/models/vrplMatch";
import { VrplPlayer } from "../db/models/vrplPlayer";
import { VrplTeam } from "../db/models/vrplTeam";
import { VrplTournament } from "../db/models/vrplTournaments";
import { getPlayerFromId } from "../db/player";
import { createTeam, getTeamFromId, getTeamFromName } from "../db/team";
import { getTournamentFromId } from "../db/tournaments";
import { BadRequestError } from "../errors";
import Match from "../schemas/Match";
import Team from "../schemas/Team";

@Resolver((of) => Match)
export default class {
  @Query((returns) => Match, { nullable: true })
  teamFromName(
    @Arg("tournamentId") tournamentId: string,
    @Arg("name") name: string
  ): Promise<VrplTeam | null> {
    return getTeamFromName(tournamentId, name);
  }

  @FieldResolver()
  async tournament(@Root() vrplMatch: VrplMatch): Promise<VrplTournament> {
    return (await getTournamentFromId(vrplMatch.id))!;
  }

  @FieldResolver()
  teams(@Root() vrplMatch: VrplMatch): Promise<VrplTeam[]> {
    return Promise.all(
      vrplMatch.teamIds.map(
        async (id) => (await getTeamFromId(vrplMatch.tournamentId, id))!
      )
    );
  }

  @FieldResolver()
  teamsConfirmed(@Root() vrplMatch: VrplMatch): Promise<VrplTeam[]> {
    return Promise.all(
      vrplMatch.teamIdsConfirmed.map(
        async (id) => (await getTeamFromId(vrplMatch.tournamentId, id))!
      )
    );
  }
}
