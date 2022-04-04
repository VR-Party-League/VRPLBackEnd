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
  areScoresInvalid as areScoresInvalid,
  confirmMatch,
  getMatchesForTeam,
  getMatchFromId,
  submitMatch,
} from "../db/match";
import {
  isCompleted,
  isSubmitted,
  SubmittedVrplMatch,
  VrplMatch,
} from "../db/models/vrplMatch";
import { isSeededVrplTeam, VrplTeam } from "../db/models/vrplTeam";
import { VrplTournament } from "../db/models/vrplTournaments";
import {
  getTeamFromId,
  getTeamFromSeed,
  getTeamsFromIds,
  getTeamsFromSeeds,
} from "../db/team";
import { getTournamentFromId } from "../db/tournaments";
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
} from "../utils/errors";
import { Permissions, userHasPermission } from "../utils/permissions";
import Match, { MatchScoreInput } from "../schemas/Match";
import { Context } from "..";
import ms from "ms";

@Resolver((_of) => Match)
export default class {
  @Query((_returns) => [Match])
  matchesForTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string
    // @Arg("activeOnly", { nullable: true }) activeOnly: boolean
  ): Promise<VrplMatch[] | null> {
    return getMatchesForTeam(tournamentId, teamId);
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
    const seeds = vrplMatch.teamSeeds;
    return getTeamsFromSeeds(vrplMatch.tournamentId, seeds);
  }

  @FieldResolver()
  async submitter(
    @Root() vrplMatch: SubmittedVrplMatch
  ): Promise<VrplTeam | null> {
    if (!isSubmitted(vrplMatch)) return null;

    return await getTeamFromSeed(
      vrplMatch.tournamentId,
      vrplMatch.submitterSeed
    );
  }

  @FieldResolver()
  async teamsConfirmed(
    @Root() vrplMatch: SubmittedVrplMatch
  ): Promise<VrplTeam[] | null> {
    if (!isSubmitted(vrplMatch)) return null;
    return await getTeamsFromSeeds(
      vrplMatch.tournamentId,
      vrplMatch.seedsConfirmed
    );
  }

  @FieldResolver()
  async winner(
    @Root() vrplMatch: SubmittedVrplMatch
  ): Promise<VrplTeam | null> {
    if (!isCompleted(vrplMatch)) return null;
    return vrplMatch.winnerId
      ? await getTeamFromId(vrplMatch.tournamentId, vrplMatch.winnerId)
      : null;
  }

  @FieldResolver()
  async losers(
    @Root() vrplMatch: SubmittedVrplMatch
  ): Promise<VrplTeam[] | null> {
    if (!isCompleted(vrplMatch)) return null;
    return getTeamsFromIds(vrplMatch.tournamentId, vrplMatch.loserIds);
  }

  @FieldResolver()
  async tied(
    @Root() vrplMatch: SubmittedVrplMatch
  ): Promise<VrplTeam[] | null> {
    if (!isCompleted(vrplMatch)) return null;
    return getTeamsFromIds(vrplMatch.tournamentId, vrplMatch.tiedIds);
  }

  @Authorized()
  @Mutation((returns) => Match)
  async confirmMatch(
    @Arg("tournamentId") tournamentId: string,
    @Arg("matchId") matchId: string,
    @Arg("teamId") teamId: string,
    @Arg("force", { nullable: true }) force: boolean,
    @Ctx() ctx: Context
  ) {
    if (!ctx.user) throw new UnauthorizedError();
    else if (!force && !userHasPermission(ctx.user, Permissions.Admin))
      throw new ForbiddenError("Only admins can use force");
    const [team, tournament, match] = await Promise.all([
      getTeamFromId(tournamentId, teamId),
      getTournamentFromId(tournamentId),
      getMatchFromId(tournamentId, matchId),
    ]);

    if (!team) throw new BadRequestError("Team not found");
    else if (!tournament) throw new BadRequestError("Tournament not found");
    else if (tournament.id !== team.tournamentId)
      throw new BadRequestError("This team is not in this tournament");
    else if (!match) throw new BadRequestError("Match not found");
    else if (!isSubmitted(match))
      throw new BadRequestError("Match has not been submitted");
    else if (!isSeededVrplTeam(team))
      throw new BadRequestError("Team is not seeded");

    const isAdmin = !userHasPermission(ctx.user, Permissions.ManageMatches);

    const isUserOnTeam = team.teamPlayers.some(
      (member) => member.playerId === ctx.user!.id
    );
    if (!isAdmin && !isUserOnTeam)
      throw new ForbiddenError("You are not on this team");
    const isTeamPlayingInMatch = match.teamSeeds.includes(team.seed);
    const isTeamSubmitterTeam = match.submitterSeed === team.seed;
    const hasTeamConfirmedAlready = match.seedsConfirmed.includes(team.seed);

    if (!force && !isTeamPlayingInMatch) throw new ForbiddenError();
    else if (!force && !isTeamSubmitterTeam)
      throw new ForbiddenError("You are not the submitter");
    else if (!force && hasTeamConfirmedAlready)
      throw new ForbiddenError("You have already confirmed this team");
    else if (!force && match.timeDeadline.getTime() + ms("24h") < Date.now())
      throw new BadRequestError("Match expired");
    else if (!force && match.timeStart.getTime() > Date.now())
      throw new BadRequestError("Match not yet started");

    // Confirm match
    const res = await confirmMatch(
      tournament,
      team.id,
      match,
      ctx.user!.id,
      force
    );
    return res;
  }

  // TODO: Create match edit mutation

  @Authorized()
  @Mutation((_returns) => Match)
  async submitMatch(
    @Arg("tournamentId") tournamentId: string,
    @Arg("matchId") matchId: string,
    @Arg("teamId") teamId: string,
    @Arg("scores", (_type) => MatchScoreInput) scores: MatchScoreInput,
    @Arg("force", { nullable: true }) force: boolean,
    @Ctx() ctx: Context
  ): Promise<SubmittedVrplMatch> {
    if (!ctx.user) throw new UnauthorizedError();
    else if (!force && !userHasPermission(ctx.user, Permissions.Admin))
      throw new ForbiddenError("Only admins can use force");
    const [team, tournament, match] = await Promise.all([
      getTeamFromId(tournamentId, teamId),
      getTournamentFromId(tournamentId),
      getMatchFromId(tournamentId, matchId),
    ]);

    if (!team) throw new BadRequestError("Team not found");
    else if (!isSeededVrplTeam(team))
      throw new BadRequestError("This team doesn't have a seed");
    else if (!tournament) throw new BadRequestError("Tournament not found");
    else if (tournament.id !== team.tournamentId)
      throw new BadRequestError("This team is not in this tournament");
    else if (!match) throw new BadRequestError("Match not found");

    const isUserOnTeam = team.teamPlayers.some(
      (member) => member.playerId === ctx.user!.id
    );
    if (!isUserOnTeam) throw new ForbiddenError("You are not on this team");

    if (
      !match.teamSeeds.includes(team.seed) &&
      !userHasPermission(ctx.user, Permissions.ManageMatches)
    )
      throw new ForbiddenError();
    else if (match.timeDeadline.getTime() < Date.now())
      throw new BadRequestError("Match expired");
    else if (match.timeStart.getTime() > Date.now())
      throw new BadRequestError("Match not yet started");
    else if (isSubmitted(match))
      throw new BadRequestError("Match already been submitted");
    const validation = areScoresInvalid(scores.rounds, match, tournament);
    if (validation) throw new BadRequestError(`Invalid scores: ${validation}`);
    const res = await submitMatch(
      tournament,
      match,
      team,
      scores.rounds,
      ctx.user.id
    );
    if (!res || !res?.id)
      throw new InternalServerError(
        "No response from submitting match: " + JSON.stringify(res)
      );
    return res;
  }
}
