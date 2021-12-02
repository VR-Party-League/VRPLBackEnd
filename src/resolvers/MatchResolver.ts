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
  SubmittedVrplMatch,
  VrplMatch,
  isSubmitted,
} from "../db/models/vrplMatch";
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
import Team from "../schemas/Team";
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
    tournamentId;
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
  async teamsConfirmed(
    @Root() vrplMatch: SubmittedVrplMatch
  ): Promise<VrplTeam[] | null> {
    return vrplMatch.teamIdsConfirmed
      ? await Promise.all(
          vrplMatch.teamIdsConfirmed.map(
            async (id) => (await getTeamFromId(vrplMatch.tournamentId, id))!
          )
        )
      : null;
  }

  @FieldResolver()
  async winner(
    @Root() vrplMatch: SubmittedVrplMatch
  ): Promise<VrplTeam | null> {
    return vrplMatch.winnerId
      ? await getTeamFromId(vrplMatch.tournamentId, vrplMatch.winnerId)
      : null;
  }

  @FieldResolver()
  async losers(
    @Root() vrplMatch: SubmittedVrplMatch
  ): Promise<VrplTeam[] | null> {
    if (!vrplMatch.loserIds) return null;
    return Promise.all(
      vrplMatch.loserIds.map(
        async (id) => (await getTeamFromId(vrplMatch.tournamentId, id))!
      )
    );
  }

  @FieldResolver()
  async tied(
    @Root() vrplMatch: SubmittedVrplMatch
  ): Promise<VrplTeam[] | null> {
    if (!vrplMatch.tiedIds) return null;
    return Promise.all(
      vrplMatch.tiedIds.map(
        async (id) => (await getTeamFromId(vrplMatch.tournamentId, id))!
      )
    );
  }

  @FieldResolver()
  async submitter(
    @Root() vrplMatch: SubmittedVrplMatch
  ): Promise<VrplTeam | null> {
    if (!vrplMatch.submitterTeamId) return null;
    return await getTeamFromId(
      vrplMatch.tournamentId,
      vrplMatch.submitterTeamId
    );
  }

  @Authorized()
  @Mutation((returns) => Match)
  async confirmMatch(
    @Arg("tournamentId") tournamentId: string,
    @Arg("matchId") matchId: string,
    @Arg("teamId") teamId: string,
    @Ctx() ctx: Context
  ) {
    if (!ctx.user) throw new UnauthorizedError();
    const [team, tournament, match] = await Promise.all([
      getTeamFromId(tournamentId, teamId),
      getTournamentFromId(tournamentId),
      getMatchFromId(tournamentId, matchId),
    ]);

    if (!team) throw new BadRequestError("Team not found");
    else if (!tournament) throw new BadRequestError("Tournament not found");
    else if (!match) throw new BadRequestError("Match not found");
    else if (!isSubmitted(match))
      throw new BadRequestError("Match had not been submitted");
    const isUserOnTeam = team.teamPlayers.some(
      (member) => member.playerId === ctx.user!.id
    );
    if (!isUserOnTeam) throw new ForbiddenError("You are not on this team");
    const isTeamPlayingInMatch = match.teamIds.includes(team.id);
    const isTeamSubmitterTeam = match.submitterTeamId === team.id;
    const hasTeamConfirmedAlready = match.teamIdsConfirmed.includes(team.id);
    const isNotAdmin = !userHasPermission(ctx.user, Permissions.ManageMatches);
    if (
      // TODO: Work this out more
      (!isTeamPlayingInMatch ||
        isTeamSubmitterTeam ||
        hasTeamConfirmedAlready) &&
      isNotAdmin
    )
      throw new ForbiddenError();
    else if (match.timeDeadline.getTime() + ms("24h") < Date.now())
      throw new BadRequestError("Match expired");
    else if (match.timeStart.getTime() > Date.now())
      throw new BadRequestError("Match not yet started");

    // Confirm match
    const res = await confirmMatch(tournament, team.id, match, ctx.user!.id);
    return res;
  }

  // TODO: Create match edit mutation

  @Authorized()
  @Mutation((returns) => Match)
  async submitMatch(
    @Arg("tournamentId") tournamentId: string,
    @Arg("matchId") matchId: string,
    @Arg("teamId") teamId: string,
    @Arg("scores", (_type) => MatchScoreInput) scores: MatchScoreInput,
    @Ctx() ctx: Context
  ): Promise<SubmittedVrplMatch> {
    if (!ctx.user) throw new UnauthorizedError();
    const [team, tournament, match] = await Promise.all([
      getTeamFromId(tournamentId, teamId),
      getTournamentFromId(tournamentId),
      getMatchFromId(tournamentId, matchId),
    ]);
    if (!team) throw new BadRequestError("Team not found");
    else if (!tournament) throw new BadRequestError("Tournament not found");
    else if (!match) throw new BadRequestError("Match not found");

    const isUserOnTeam = team.teamPlayers.some(
      (member) => member.playerId === ctx.user!.id
    );
    if (!isUserOnTeam) throw new ForbiddenError("You are not on this team");

    if (
      !match.teamIds.includes(team.id) &&
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
      teamId,
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
