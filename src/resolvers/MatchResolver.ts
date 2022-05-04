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
  async matchesForTeam(
    @Arg("tournamentId") tournamentId: string,
    @Arg("teamId") teamId: string
    // @Arg("activeOnly", { nullable: true }) activeOnly: boolean
  ): Promise<VrplMatch[]> {
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new BadRequestError(`Team not found`);
    else if (team.seed === undefined) return [];
    return getMatchesForTeam(tournamentId, team.seed);
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
  @Mutation((_returns) => Match)
  async confirmMatch(
    @Arg("tournamentId") tournamentId: string,
    @Arg("matchId") matchId: string,
    @Arg("teamId") teamId: string,
    @Arg("force", { nullable: true }) force: boolean,
    @Ctx() ctx: Context
  ) {
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();
    else if (!force && !userHasPermission(user, Permissions.Admin))
      throw new ForbiddenError("Only admins can use force");
    const [tournament, match] = await Promise.all([
      getTournamentFromId(tournamentId),
      getMatchFromId(tournamentId, matchId),
    ]);
    if (!match) throw new BadRequestError("Match not found");
    const teams = await getTeamsFromSeeds(tournamentId, match.teamSeeds);
    const team = teams.find((t) => t.id === teamId);
    if (!team) throw new BadRequestError("Team not found");
    else if (!tournament) throw new BadRequestError("Tournament not found");
    else if (tournament.id !== team.tournamentId)
      throw new BadRequestError("This team is not in this tournament");
    else if (!isSubmitted(match))
      throw new BadRequestError("Match has not been submitted");

    const isAdmin = userHasPermission(user, Permissions.ManageMatches);

    const isUserOnTeam =
      team.teamPlayers.some((member) => member.playerId === user.id) ||
      team.ownerId === user.id;
    if (!isAdmin && !isUserOnTeam)
      throw new ForbiddenError("You are not on this team");
    const isTeamPlayingInMatch = match.teamSeeds.includes(team.seed);
    const isTeamSubmitterTeam = match.submitterSeed === team.seed;
    const hasTeamConfirmedAlready = match.seedsConfirmed.includes(team.seed);

    if (!force && !isTeamPlayingInMatch) throw new ForbiddenError();
    else if (!force && isTeamSubmitterTeam)
      throw new ForbiddenError("You are the submitter");
    else if (!force && hasTeamConfirmedAlready)
      throw new ForbiddenError("You have already confirmed this team");
    else if (!force && match.timeDeadline.getTime() + ms("24h") < Date.now())
      throw new BadRequestError("Match expired");
    else if (!force && match.timeStart.getTime() > Date.now())
      throw new BadRequestError("Match not yet started");

    // Confirm match
    const res = await confirmMatch(
      tournament,
      team,
      teams,
      match,
      user.id,
      force
    );
    return res;
  }

  // TODO: Check if this works when resubmitting a match
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
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();
    else if (!force && !userHasPermission(user, Permissions.Admin))
      throw new ForbiddenError("Only admins can use force");

    const [tournament, match] = await Promise.all([
      getTournamentFromId(tournamentId),
      getMatchFromId(tournamentId, matchId),
    ]);
    if (!match) throw new BadRequestError("Match not found");
    const teams = await getTeamsFromSeeds(tournamentId, match.teamSeeds);
    const team = teams.find((team) => team.id === teamId);
    if (!team) throw new BadRequestError("Team not found or not seeded");
    else if (!tournament) throw new BadRequestError("Tournament not found");
    else if (tournament.id !== team.tournamentId)
      throw new BadRequestError("This team is not in this tournament");

    const isAdmin = userHasPermission(user, Permissions.ManageMatches);
    const isUserOnTeam =
      team.teamPlayers.some((member) => member.playerId === user.id) ||
      team.ownerId === user.id;
    if (!isUserOnTeam && !isAdmin)
      throw new ForbiddenError("You are not on this team");

    if (!match.teamSeeds.includes(team.seed) && !isAdmin)
      throw new ForbiddenError();
    else if (match.timeDeadline.getTime() < Date.now())
      throw new BadRequestError("Match expired");
    else if (match.timeStart.getTime() > Date.now())
      throw new BadRequestError("Match not yet started");
    else if (isCompleted(match))
      throw new BadRequestError("Match already been completed");
    // else if (isSubmitted(match))
    //   throw new BadRequestError("Match already been submitted");
    const validation = areScoresInvalid(scores.rounds, match, tournament);
    if (validation) throw new BadRequestError(`Invalid scores: ${validation}`);
    const res = await submitMatch(
      tournament,
      match,
      team,
      teams,
      scores.rounds,
      user.id
    );
    if (!res || !res?.id)
      throw new InternalServerError(
        "No response from submitting match: " + JSON.stringify(res)
      );
    return res;
  }
}
