import {
  Arg,
  Authorized,
  Ctx,
  Field,
  FieldResolver,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { Context } from "..";
import { getGameById } from "../db/game";
import {
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
  getTournamentFromName,
} from "../db/tournaments";
import Team from "../schemas/Team";
import Tournament from "../schemas/Tournament";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "../utils/errors";
import { Permissions, userHasPermission } from "../utils/permissions";

@Resolver((_of) => Tournament)
export default class {
  @Query((_returns) => Tournament, { nullable: true })
  async tournamentFromId(@Arg("id") id: string) {
    const rawTournament = await getTournamentFromId(id);
    return rawTournament;
  }

  @Query((_returns) => Tournament, { nullable: true })
  async tournamentFromName(@Arg("name") name: string) {
    const rawTournament = await getTournamentFromName(name);
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
  async currentMatches(
    @Root() vrplTournament: VrplTournament
  ): Promise<VrplMatch[] | undefined> {
    return getCurrentMatchesOfTournament(vrplTournament.id);
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

  @Authorized()
  @Mutation((_returns) => Team)
  async createTeamForTournament(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamName") teamName: string,
    @Arg("ownerId") ownerId: string,
    @Arg("makeCaptain", { nullable: true }) makeCaptain: boolean,
    @Ctx() ctx: Context
  ): Promise<VrplTeam> {
    // TODO: Improve this
    const user = ctx.user;
    const [tournament, owner, team] = await Promise.all([
      getTournamentFromId(tournamentId),
      getPlayerFromId(ownerId),
      getTeamFromName(tournamentId, teamName),
    ]);

    if (!user) throw new UnauthorizedError();
    else if (!tournament) throw new BadRequestError("Tournament not found");
    else if (!owner) throw new ForbiddenError("Owner not found");
    else if (team) throw new BadRequestError("Team already exists");
    else if (
      user.id !== ownerId &&
      !userHasPermission(user, Permissions.ManageTeams)
    )
      throw new ForbiddenError();
    else if (tournament.registrationEnd < new Date())
      throw new ForbiddenError("Registration is closed");
    else if (tournament.registrationStart > new Date())
      throw new ForbiddenError("Registration is not open");
    const createdTeamRes = await createTeam(
      tournamentId,
      teamName,
      ownerId,
      user.id
    );

    if (makeCaptain) {
      await addPlayerToTeam(
        createdTeamRes,
        ownerId,
        VrplTeamPlayerRole.Captain
      );
    }
    return createdTeamRes;
  }

  @Authorized([Permissions.ManageTournaments])
  @Query((_returns) => draftRoundRobin, { nullable: false })
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

  @Authorized([Permissions.ManageTournaments])
  @Mutation((_returns) => [Team])
  async seedsTeamsForTournament(
    @Arg("tournamentId") tournamentId: string,
    @Ctx() ctx: Context
  ) {
    const { user } = ctx;
    if (!user) throw new UnauthorizedError();
    const tournament = await getTournamentFromId(tournamentId);
    if (!tournament) throw new BadRequestError("Tournament not found");
    const teams = await seedAllTeams(tournament, user.id);
    return teams;
  }

  @Authorized([Permissions.ManageTournaments])
  @Mutation((_returns) => [Team])
  async unSeedTeamsForTournament(
    @Arg("tournamentId") tournamentId: string,
    @Ctx() ctx: Context
  ) {
    const { user } = ctx;
    if (!user) throw new UnauthorizedError();
    const tournament = await getTournamentFromId(tournamentId);
    if (!tournament) throw new BadRequestError("Tournament not found");
    const teams = await unSeedAllTeams(tournament, user.id);
    return teams;
  }
}

@ObjectType()
class draftRoundRobin {
  @Field((_type) => [[[Team]]])
  matchups: VrplTeam[][][];

  @Field((_type) => [[[Int]]])
  seeds: number[][][];
}
