import { VrplTournament } from "../models/vrplTournaments";
import { BadRequestError, InternalServerError } from "../../utils/errors";
import { getTeamsFromSeeds, updateTeamsAfterMatch } from "../team";
import VrplMatchDB, {
  CompletedVrplMatch,
  isSubmitted,
  SubmittedVrplMatch,
  VrplMatch,
} from "../models/vrplMatch";
import {
  matchCompleteRecord,
  matchConfirmRecord,
  matchSubmitRecord,
} from "../models/records/matchRecords";
import { v4 as uuidv4 } from "uuid";
import { storeAndBroadcastRecord, storeAndBroadcastRecords } from "../records";
import {
  areScoresInvalid,
  getWinningSeedsForMatch,
  isMatchSubmitted,
} from "./index";
import { SeededVrplTeam } from "../models/vrplTeam";
import { recordType } from "../models/records";
import { VrplAuth } from "../../index";

export async function submitMatch(
  tournament: VrplTournament,
  match: SubmittedVrplMatch | VrplMatch,
  team: SeededVrplTeam,
  teams: SeededVrplTeam[],
  scores: number[][],
  auth: VrplAuth,
  isForfeit?: boolean,
  force?: boolean
): Promise<SubmittedVrplMatch | null> {
  if (!match || !tournament) return null;
  else if (isSubmitted(match)) {
    match.seedsConfirmed = [];
    // throw new BadRequestError("Match submitted already");
  } else if (areScoresInvalid(scores, match, tournament))
    throw new BadRequestError("Invalid match scores");
  else if (!force && Date.now() < match.timeStart.getTime())
    throw new BadRequestError("Match not started yet");
  else if (!force && Date.now() > match.timeDeadline.getTime())
    throw new BadRequestError("Deadline for match reached");
  const timeSubmitted = new Date();

  const submitterTeamSeed = team.seed;
  const winData = getWinningSeedsForMatch(match.teamSeeds, scores);
  let winnerSeed: number | undefined;
  let tiedSeeds: number[] = [];
  let lostSeeds: number[] = [];
  if (winData.length > 1) tiedSeeds = winData;
  else if (winData.length === 1) winnerSeed = winData[0];
  else if (winData.length === 0) lostSeeds = match.teamSeeds;

  for (const seed of match.teamSeeds) {
    let isTeamWinner = seed === winnerSeed;
    let hasTeamTied = tiedSeeds.includes(seed);
    let hasTeamLost = lostSeeds.includes(seed);
    if (isTeamWinner || hasTeamTied || hasTeamLost) continue;
    lostSeeds.push(seed);
  }

  let winner = undefined;
  if (winnerSeed) winner = teams.find((team) => team.seed === winnerSeed);

  const tiedTeams = teams.filter((team) => tiedSeeds.includes(team.seed));
  const lostTeams = teams.filter((team) => lostSeeds.includes(team.seed));

  if (tiedTeams.length !== tiedSeeds.length)
    throw new InternalServerError("Tied teams are not equal to tied seeds");
  else if (lostTeams.length !== lostSeeds.length)
    throw new InternalServerError("Lost teams are not equal to lost seeds");
  else if (winner && winner.seed !== winnerSeed)
    throw new InternalServerError("Winner is not equal to winner seed");

  const submittedMatch: SubmittedVrplMatch = {
    ...match,
    submitterSeed: team.seed,
    seedsConfirmed: [],
    scores: scores,
    timeSubmitted: timeSubmitted,
    isForfeit: isForfeit || false,

    winnerId: winner?.id,
    tiedIds: tiedTeams.map((team) => team.id),
    loserIds: lostTeams.map((team) => team.id),
  };

  const resultPromise = VrplMatchDB.findOneAndUpdate(
    { id: match.id },
    {
      $set: {
        submitterSeed: submittedMatch.submitterSeed,
        seedsConfirmed: submittedMatch.seedsConfirmed,
        scores: submittedMatch.scores,
        timeSubmitted: submittedMatch.timeSubmitted,
        isForfeit: submittedMatch.isForfeit,

        winnerId: submittedMatch.winnerId,
        tiedIds: submittedMatch.tiedIds,
        loserIds: submittedMatch.loserIds,
      },
    },
    {
      new: true,
    }
  );
  const record: matchSubmitRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.matchSubmit,
    timestamp: timeSubmitted,
    tournamentId: tournament.id,
    tournamentSlug: tournament.slug,
    performedByUserId: auth.userId,
    performedByPlayerId: auth.playerId,
    matchId: match.id,
    teamId: team.id,
    teamSeed: team.seed,
    scores: scores,
    teamIds: teams.map((team) => team.id),
  };
  const [result] = await Promise.all([
    resultPromise,
    storeAndBroadcastRecord(record),
  ]);
  return result as SubmittedVrplMatch;
}

/**
 * This function is used to complete a match once it has been confirmed enough times
 * This also confirms the match that it completes
 * @param {VrplTournament} tournament the match to confirm and complete
 * @param {SubmittedVrplMatch} match the team that will be the final team to confirm the match
 * @param {SeededVrplTeam} team the team that will be the final team to confirm the match
 * @param {SeededVrplTeam[]} teams all the teams playing in the match
 * @param {VrplAuth} auth the user that confirmed the match
 * @param {boolean} force ignore any checks
 * @returns CompletedVrplMatch | null
 */
export async function completeMatch(
  tournament: VrplTournament,
  match: SubmittedVrplMatch,
  team: SeededVrplTeam,
  teams: SeededVrplTeam[],
  auth: VrplAuth,
  force?: boolean
): Promise<CompletedVrplMatch> {
  if (!match.seedsConfirmed.includes(team.seed))
    match.seedsConfirmed.push(team.seed);
  if (match.seedsConfirmed.length < match.teamSeeds.length / 2 && !force)
    throw new Error("This match hasn't been confirmed yet");

  const completedMatch: CompletedVrplMatch = {
    id: match.id,
    submitterSeed: match.submitterSeed,
    winnerId: match.winnerId,
    tiedIds: match.tiedIds,
    loserIds: match.loserIds,

    teamSeeds: match.teamSeeds,
    seedsConfirmed: match.seedsConfirmed,
    tournamentId: match.tournamentId,
    isForfeit: match.isForfeit,

    scores: match.scores,
    timeStart: match.timeStart,
    timeDeadline: match.timeDeadline,
    timeSubmitted: match.timeSubmitted,
    timeConfirmed: new Date(),
  };
  const resultPromise = VrplMatchDB.updateOne(
    { id: match.id, tournament: match.tournamentId },
    {
      $set: {
        seedsConfirmed: completedMatch.seedsConfirmed,
        timeConfirmed: completedMatch.timeConfirmed,
      },
    }
  );
  const recordConfirm: matchConfirmRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.matchConfirm,
    timestamp: completedMatch.timeConfirmed,
    tournamentId: completedMatch.tournamentId,
    tournamentSlug: tournament.slug,
    matchId: completedMatch.id,

    scores: match.scores,
    teamId: team.id,
    teamSeed: team.seed,
    performedByUserId: auth.userId,
    performedByPlayerId: auth.playerId,
    teamIds: teams.map((team) => team.id),
  };
  const recordComplete: matchCompleteRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.matchComplete,
    timestamp: completedMatch.timeConfirmed,
    tournamentId: completedMatch.tournamentId,
    tournamentSlug: tournament.slug,
    matchId: completedMatch.id,

    teamId: team.id,
    teamSeed: team.seed,
    scores: match.scores,

    performedByUserId: auth.userId,
    performedByPlayerId: auth.playerId,
    winnerId: completedMatch.winnerId,
    tiedIds: completedMatch.tiedIds,
    loserIds: completedMatch.loserIds,
    teamIds: teams.map((team) => team.id),
  };
  const [result] = await Promise.all([
    resultPromise,
    storeAndBroadcastRecords([recordConfirm, recordComplete]),
    updateTeamsAfterMatch(completedMatch, teams),
  ]);
  if (result.modifiedCount === 0) throw new Error("Failed to complete match");
  else return completedMatch;
}

// TODO: Untested
/*
 * All teams need to confirm match (except the team that submitted the scores)
 */
export async function confirmMatch(
  tournament: VrplTournament,
  team: SeededVrplTeam,
  teams: SeededVrplTeam[],
  match: SubmittedVrplMatch,
  auth: VrplAuth,
  force?: boolean
): Promise<SubmittedVrplMatch> {
  if (!match || !tournament)
    throw new InternalServerError("Invalid match or tournament");
  else if (match.seedsConfirmed.includes(team.seed))
    throw new BadRequestError("This team has already confirmed this match");
  else if (!force && !match.teamSeeds.includes(team.seed))
    throw new BadRequestError("This team is not playing in this match");

  match.seedsConfirmed.push(team.seed);
  if (match.seedsConfirmed.length === match.teamSeeds.length - 1) {
    return completeMatch(tournament, match, team, teams, auth, force);
  }

  const record: matchConfirmRecord = {
    v: 1,
    id: uuidv4(),
    timestamp: new Date(),
    type: recordType.matchConfirm,
    performedByUserId: auth.userId,
    performedByPlayerId: auth.playerId,
    tournamentId: tournament.id,
    tournamentSlug: tournament.slug,
    matchId: match.id,
    teamId: team.id,
    teamSeed: team.seed,
    scores: match.scores,
    teamIds: teams.map((t) => t.id),
  };
  const resultPromise = VrplMatchDB.updateOne(
    { id: match.id, tournamentId: tournament.id },
    {
      $set: {
        seedsConfirmed: match.seedsConfirmed,
      },
    }
  );
  const [result] = await Promise.all([
    resultPromise,
    storeAndBroadcastRecord(record),
  ]);
  if (result.modifiedCount !== 1)
    throw new InternalServerError(
      `Failed to confirm match ${match.id} (modified: ${result.modifiedCount}, matched: ${result.matchedCount})`
    );
  else return match;
}
