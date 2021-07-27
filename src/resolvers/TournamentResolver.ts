import { Arg, FieldResolver, Query, Resolver, Root } from "type-graphql";
import { getMatchFromId } from "../db/match";
import { VrplMatch } from "../db/models/vrplMatch";
import { VrplTeam } from "../db/models/vrplTeam";
import { VrplTournament } from "../db/models/vrplTournaments";
import { getTeamsOfTournament } from "../db/team";
import {
  getAllTournaments,
  getTournamentFromId,
  getTournamentFromName,
} from "../db/tournaments";
import Tournament from "../schemas/Tournament";

@Resolver((_of) => Tournament)
export default class {
  @Query((_returns) => Tournament, { nullable: true })
  async tournamentFromId(@Arg("id") id: string): Promise<Tournament | null> {
    const rawTournament = await getTournamentFromId(id);
    if (rawTournament) return Object.assign(new Tournament(), rawTournament);
    return null;
  }
  @Query((_returns) => Tournament, { nullable: true })
  async tournamentFromName(
    @Arg("name") name: string
  ): Promise<Tournament | null> {
    const rawTournament = await getTournamentFromName(name);
    if (rawTournament) return Object.assign(new Tournament(), rawTournament);
    return null;
  }
  @Query((_returns) => [Tournament], { nullable: false })
  async allTournaments(): Promise<Tournament[]> {
    const rawTournaments = await getAllTournaments();
    return rawTournaments.map((rawTournament) =>
      Object.assign(new Tournament(), rawTournament)
    );
  }

  @FieldResolver()
  async matches(@Root() vrplTournament: VrplTournament): Promise<VrplMatch[]> {
    return Promise.all(
      vrplTournament.matchIds.map(
        async (id) => (await getMatchFromId(vrplTournament.id, id))!
      )
    );
  }
  @FieldResolver()
  async currentMatches(
    @Root() vrplTournament: VrplTournament
  ): Promise<VrplMatch[] | undefined> {
    if (!vrplTournament.currentMatchIds) return undefined;
    return Promise.all(
      vrplTournament.currentMatchIds?.map(
        async (id) => (await getMatchFromId(vrplTournament.id, id))!
      )
    );
  }

  @FieldResolver()
  async teams(@Root() vrplTournament: VrplTournament): Promise<VrplTeam[]> {
    return await getTeamsOfTournament(vrplTournament.id);
  }
  // @Mutation((returns) => Team)
  // async create(
  //   @Arg("tournamentId") tournamentId: string,
  //   @Arg("teamName") teamName: string,
  //   @Arg("captainId") captainId: string
  // ): Promise<Team> {
  //   const res = await createTeam(tournamentId, teamName, captainId);
  //   console.log(res);
  //   if (res.success) Object.assign(new Team(), res.doc);
  //   throw new BadRequestError(`${res.error}`);
  // }
}
