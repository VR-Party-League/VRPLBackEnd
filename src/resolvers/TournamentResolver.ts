import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { Context } from "..";
import { getGameById } from "../db/game";
import {
  createMatches,
  getCurrentMatchesOfTournament,
  getMatchesOfTournament,
} from "../db/match";
import { VrplGame } from "../db/models/vrplGame";
import { VrplMatch } from "../db/models/vrplMatch";
import { VrplTeam, VrplTeamPlayerRole } from "../db/models/vrplTeam";
import { VrplTournament } from "../db/models/vrplTournaments";
import { getPlayerFromId } from "../db/player";
import {
  addPlayerToTeam,
  createTeam,
  getTeamFromName,
  getTeamsOfTournament,
  seedAllTeams,
  unSeedAllTeams,
} from "../db/team";
import {
  generateRoundRobinForTournament,
  getAllTournaments,
  getTournamentFromId,
  getTournamentFromSlug,
} from "../db/tournaments";
import Team from "../schemas/Team";
import Tournament from "../schemas/Tournament";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "../utils/errors";
import { Authenticate, Permissions, ResolveTeam } from "../utils/permissions";
import Match from "../schemas/Match";
import { revalidateTournamentPage } from "../db/records";

@Resolver((_of) => Tournament)
export default class {
  @Query((_returns) => Tournament, { nullable: true })
  async tournamentFromId(@Arg("id") id: string) {
    const rawTournament = await getTournamentFromId(id);
    return rawTournament;
  }

  @Query((_returns) => Tournament, { nullable: true })
  async tournamentFromSlug(@Arg("slug") slug: string) {
    const rawTournament = await getTournamentFromSlug(slug);
    return rawTournament;
  }

  @Query((_returns) => [Tournament], { nullable: false })
  async allTournaments() {
    const rawTournaments = await getAllTournaments();
    return rawTournaments;
  }

  @FieldResolver()
  async matches(@Root() vrplTournament: VrplTournament): Promise<VrplMatch[]> {
    return getMatchesOfTournament(vrplTournament.id);
  }

  @FieldResolver()
  async currentMatches(@Root() vrplTournament: VrplTournament) {
    return await getCurrentMatchesOfTournament(vrplTournament.id);
  }

  @FieldResolver()
  async teams(@Root() vrplTournament: VrplTournament): Promise<VrplTeam[]> {
    return await getTeamsOfTournament(vrplTournament.id);
  }

  @FieldResolver()
  async game(@Root() vrplTournament: VrplTournament): Promise<VrplGame> {
    const game = await getGameById(vrplTournament.gameId);
    if (!game) throw new Error("Game not found");
    return game;
  }

  @Mutation((_returns) => Team)
  @UseMiddleware(Authenticate(["team.owner:write"]))
  async createTeamForTournament(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamName") teamName: string,
    @Arg("ownerId") ownerId: string,
    @Arg("makeCaptain", { nullable: true }) makeCaptain: boolean,
    @Ctx() { auth }: Context
  ): Promise<VrplTeam> {
    // TODO: Improve this
    const [tournament, owner, team] = await Promise.all([
      getTournamentFromId(tournamentId),
      getPlayerFromId(ownerId),
      getTeamFromName(tournamentId, teamName),
    ]);

    if (!auth) throw new UnauthorizedError();
    else if (!tournament) throw new BadRequestError("Tournament not found");
    else if (!owner) throw new ForbiddenError("Owner not found");
    else if (team) throw new BadRequestError("Team already exists");
    else if (auth.playerId !== ownerId)
      auth.assurePerm(Permissions.ManageTeams);
    else if (tournament.registrationEnd < new Date())
      throw new ForbiddenError("Registration is closed");
    else if (tournament.registrationStart > new Date())
      throw new ForbiddenError("Registration is not open");
    const createdTeamRes = await createTeam(
      tournament.id,
      teamName,
      ownerId,
      auth
    );

    if (makeCaptain) {
      await addPlayerToTeam(
        createdTeamRes,
        ownerId,
        VrplTeamPlayerRole.Captain,
        auth
      );
    }
    return createdTeamRes;
  }

  @Query((_returns) => draftRoundRobin, { nullable: false })
  @UseMiddleware(
    Authenticate(["USE_PERMISSIONS"], [Permissions.ManageTournaments])
  )
  async getDraftRoundRobin(
    @Arg("tournamentId") tournamentId: string,
    @Arg("rounds", (_type) => Int) rounds: number,
    @Arg("offset", (_type) => Int, { nullable: true }) offset?: number
  ) {
    const tournament = await getTournamentFromId(tournamentId);
    if (!tournament) throw new BadRequestError("Tournament not found");
    const draft = await generateRoundRobinForTournament(
      tournament,
      rounds,
      offset
    );
    return draft;
  }

  @Mutation((_returns) => [Match])
  @UseMiddleware(
    Authenticate(["USE_PERMISSIONS"], [Permissions.ManageTournaments])
  )
  async addMatchesToTournament(
    @Arg("tournamentId") tournamentId: string,
    @Arg("rounds", (_type) => [MatchRoundInput]) rounds: MatchRoundInput[],
    @Arg("submit", { nullable: true }) submit?: boolean
  ) {
    const tournament = await getTournamentFromId(tournamentId);
    if (!tournament) throw new BadRequestError("Tournament not found");
    const res = await createMatches(tournament, rounds, submit);
    console.log(res);
    return res;
  }

  @Mutation((_returns) => [Team])
  @UseMiddleware(
    Authenticate(["USE_PERMISSIONS"], [Permissions.ManageTournaments])
  )
  async seedsTeamsForTournament(
    @Arg("tournamentId") tournamentId: string,
    @Ctx() { auth }: Context
  ) {
    if (!auth) throw new UnauthorizedError();
    const tournament = await getTournamentFromId(tournamentId);
    if (!tournament) throw new BadRequestError("Tournament not found");
    const teams = await seedAllTeams(tournament, auth);
    return teams;
  }

  @Mutation((_returns) => [Team])
  @UseMiddleware(
    Authenticate(["USE_PERMISSIONS"], [Permissions.ManageTournaments])
  )
  async unSeedTeamsForTournament(
    @Arg("tournamentId") tournamentId: string,
    @Ctx() { auth }: Context
  ) {
    if (!auth) throw new UnauthorizedError();
    const tournament = await getTournamentFromId(tournamentId);
    if (!tournament) throw new BadRequestError("Tournament not found");
    const teams = await unSeedAllTeams(tournament, auth);
    return teams;
  }

  @Mutation((_returns) => Tournament)
  @UseMiddleware(
    Authenticate(["USE_PERMISSIONS"], [Permissions.ManageTournaments])
  )
  async revalidateTournamentPage(@Arg("tournamentId") tournamentId: string) {
    const tournament = await getTournamentFromId(tournamentId);
    if (!tournament) throw new BadRequestError("Tournament not found");
    await revalidateTournamentPage(tournament.name);
    return tournament;
  }

  // @UseMiddleware(ResolvePlayer("playerId", true, Permissions.ManagePlayers))
  // @UseMiddleware(
  //   ResolveTeam(
  //     "teamId",
  //     "tournamentId",
  //     { ownerOf: true },
  //     Permissions.ManageTeams
  //   )
  // )
  // @Mutation((_returns) => Boolean)
  // testTEST(
  //   @Arg("teamId") _: string,
  //   @Arg("tournamentId") __: string,
  //   @Ctx() { resolved: { team }, auth }: Context
  // ) {
  //   console.log("[testTEST] team", team);
  //   console.log("[testTEST] auth", auth);
  //   return true;
  // }
}

@ObjectType()
class draftRoundRobin {
  @Field((_type) => [[[Team]]])
  matchups: VrplTeam[][][];

  @Field((_type) => [[[Int]]])
  seeds: number[][][];
}

@InputType("MatchRoundInputMatch")
class MatchRoundInputMatch {
  @Field((_type) => Int)
  team1Seed: number;
  @Field((_type) => Int)
  team2Seed: number;
}

@InputType("MatchRoundInput")
class MatchRoundInput {
  @Field((_type) => [MatchRoundInputMatch])
  matches: MatchRoundInputMatch[];
  @Field((_type) => Date)
  start: Date;
  @Field((_type) => Date)
  end: Date;
}

// TODO: tournament from slug
// TODO: teamFromId tournametn name to slug
