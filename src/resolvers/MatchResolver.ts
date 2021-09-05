import {
  Arg,
  Authorized,
  Ctx,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
  UnauthorizedError,
} from "type-graphql";
import {
  areScoresInValid,
  confirmMatch,
  getMatchesForTeam,
  getMatchFromId,
  isMatchSubmitted,
  submitMatch,
} from "../db/match";
import { VrplMatch } from "../db/models/vrplMatch";
import { VrplTeam } from "../db/models/vrplTeam";
import { VrplTournament } from "../db/models/vrplTournaments";
import { getTeamFromId, getTeamFromName } from "../db/team";
import { getTournamentFromId } from "../db/tournaments";
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
} from "../utils/errors";
import { userHasPermission } from "../utils/permissions";
import Match, { MatchScoreInput } from "../schemas/Match";
import { Permissions } from "../utils/permissions";
import { Context } from "..";

@Resolver((_of) => Match)
export default class {
  @Query((_returns) => [Match])
  matchesForTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("activeOnly", { nullable: true }) activeOnly: boolean
  ): Promise<VrplMatch[]> {
    return getMatchesForTeam(tournamentId, teamId, activeOnly);
  }

  @Query((_returns) => Match, { nullable: true })
  matchFromId(
    @Arg("tournamentId") tournamentId: string,
    @Arg("matchId") matchId: string
  ): Promise<VrplMatch | null> {
    return getMatchFromId(tournamentId, matchId);
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

  // TODO: Untested
  @Authorized()
  @Mutation((returns) => Match)
  async confirmMatch(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("matchId") matchId: string,
    @Ctx() ctx: Context
  ) {
    if (!ctx.user) throw new UnauthorizedError();
    const [team, tournament] = await Promise.all([
      getTeamFromId(tournamentId, teamId),
      getTournamentFromId(tournamentId),
    ]);
    if (!team) throw new BadRequestError("Team not found");
    else if (!tournament) throw new BadRequestError("Tournament not found");
    const match = await getMatchFromId(tournamentId, teamId);
    if (!match) throw new BadRequestError("Match not found");
    else if (
      !match.teamIds.includes(team.id) &&
      !userHasPermission(ctx.user, Permissions.ManageMatches)
    )
      throw new ForbiddenError();
    else if (match.timeDeadline.getTime() < Date.now())
      throw new BadRequestError("Match expired");
    else if (match.teamIdsConfirmed.includes(team.id))
      throw new BadRequestError("Match already confirmed by this team");
    else if (!isMatchSubmitted(match, tournament))
      throw new BadRequestError("Match not submitted");
    const res = await confirmMatch(tournamentId, teamId, matchId, ctx.user.id);
    if (!res) throw new InternalServerError();
    return res;
  }

  // TODO: Untested
  @Authorized()
  @Mutation((returns) => Match)
  async submitMatch(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string,
    @Arg("matchId") matchId: string,
    @Arg("scores", (_type) => MatchScoreInput) scores: MatchScoreInput,
    @Ctx() ctx: Context
  ) {
    if (!ctx.user) throw new UnauthorizedError();
    const [team, tournament, match] = await Promise.all([
      getTeamFromId(tournamentId, teamId),
      getTournamentFromId(tournamentId),
      getMatchFromId(tournamentId, teamId),
    ]);
    if (!team) throw new BadRequestError("Team not found");
    else if (!tournament) throw new BadRequestError("Tournament not found");
    else if (!match) throw new BadRequestError("Match not found");
    else if (
      !match.teamIds.includes(team.id) &&
      !userHasPermission(ctx.user, Permissions.ManageMatches)
    )
      throw new ForbiddenError();
    else if (match.timeDeadline.getTime() < Date.now())
      throw new BadRequestError("Match expired");
    else if (match.timeStart.getTime() > Date.now())
      throw new BadRequestError("Match not yet started");
    else if (match.teamIdsConfirmed.includes(team.id))
      throw new BadRequestError("Match already confirmed by this team");
    else if (!isMatchSubmitted(match, tournament))
      throw new BadRequestError("Match not submitted");
    const validation = areScoresInValid(scores.rounds, match, tournament);
    if (validation) throw new BadRequestError(`Invalid scores: ${validation}`);
    const res = await submitMatch(
      tournamentId,
      matchId,
      teamId,
      scores.rounds,
      ctx.user.id
    );
    if (!res) throw new InternalServerError();
    return res;
  }
}
