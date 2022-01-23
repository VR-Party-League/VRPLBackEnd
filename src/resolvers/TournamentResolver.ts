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
import { getGameById } from "../db/game";
import { getMatchFromId } from "../db/match";
import { VrplGame } from "../db/models/vrplGame";
import { VrplMatch } from "../db/models/vrplMatch";
import { VrplTeam, VrplTeamPlayerRole } from "../db/models/vrplTeam";
import { VrplTournament } from "../db/models/vrplTournaments";
import { getPlayerFromId } from "../db/player";
import {
  addPlayerToTeam,
  createTeam,
  getTeamFromId,
  getTeamFromName,
  getTeamsOfTournament,
} from "../db/team";
import {
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
}
