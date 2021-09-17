import ms from "ms";
import VrplMatchDB, {
  CompletedVrplMatch,
  PlainVrplMatch,
  SubmittedVrplMatch,
  VrplMatch,
} from "../db/models/vrplMatch";
import { v4 as uuidv4 } from "uuid";
import Match from "../schemas/Match";
import { VrplTournament } from "./models/vrplTournaments";
import { getTournamentFromId } from "./tournaments";
import {
  matchCompleteRecord,
  matchConfirmRecord,
  matchCreateRecord,
  matchForfeitRecord,
  matchSubmitRecord,
} from "./models/records/matchRecords";
import { recordType } from "./models/records";
import { storeRecord, storeRecords } from "./logs";
import { getTeamsOfTournament, updateTeamsAfterMatch } from "./team";
import _ from "lodash";

export async function getMatchFromId(tournamentId: string, matchId: string) {
  const match = await VrplMatchDB.findOne({
    tournamentId: tournamentId,
    id: matchId,
  });
  if (!match || match.tournamentId !== tournamentId) return null;
  return match;
}

export async function getMatchesForTeam(tournamentId: string, teamId: string) {
  return await VrplMatchDB.find({
    tournamentId: tournamentId,
    teamIds: teamId,
    // TODO: add an activeOnly option
  });
}

// Function that submits scores for a match
// TODO: Untested
export async function submitMatch(
  tournament: VrplTournament,
  match: SubmittedVrplMatch,
  teamId: string,
  scores: number[][],
  performedBy: string,
  isForfeit?: boolean,
  force?: boolean
): Promise<VrplMatch | null> {
  if (!match || !tournament) return null;
  else if (!force && isMatchSubmitted(match, tournament)) return null;
  else if (!areScoresInValid(scores, match, tournament)) return null;
  else if (!force && match.timeStart.getTime() > Date.now()) return null;
  else if (!force && match.timeDeadline.getTime() < Date.now()) return null;

  match.scores = scores;
  match.isForfeit = isForfeit || false;
  match.timeSubmitted = new Date();

  const resultPromise = VrplMatchDB.updateOne(
    { id: match.id },
    {
      $set: {
        teamIdsConfirmed: [],
        scores: match.scores,
        timeSubmitted: match.timeSubmitted,
        isForfeit: match.isForfeit,
      },
    }
  );
  const record: matchSubmitRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.matchSubmit,
    timestamp: match.timeSubmitted,
    tournamentId: tournament.id,
    matchId: match.id,
    teamId: teamId,
    userId: performedBy,
    scores: match.scores,
  };
  const [result] = await Promise.all([resultPromise, storeRecord(record)]);
  if (result.modifiedCount === 0) return null;
  else return match;
}

/**
 * This function is used to complete a match once it has been confirmed enough times
 * This also confirms that the match is complete
 * @param {SubmittedVrplMatch} match the match to confirm and complete
 * @param {string} teamId the team that will be the final team to confirm the match
 * @param {string} performedBy the user that confirmed the match
 * @returns CompletedVrplMatch | null
 */
export async function completeMatch(
  match: SubmittedVrplMatch,
  teamId: string,
  performedBy: string
): Promise<CompletedVrplMatch | null> {
  if (match.teamIdsConfirmed.length < match.teamIds.length / 2)
    throw new Error("This match hasn't been confirmed yet");
  const winData = getWinnerFromMatch(match);
  let winner: string | undefined;
  const tied: string[] = [];
  const lost: string[] = [];
  if (winData.length > 1) winner = winData[0];

  for (const teamId of match.teamIds) {
    if (teamId !== winner && !tied.includes(teamId)) lost.push(teamId);
  }
  const completedMatch: CompletedVrplMatch = {
    id: match.id,
    winnerId: winner,
    tiedIds: tied,
    loserIds: lost,

    teamIds: match.teamIds,
    teamIdsConfirmed: match.teamIdsConfirmed,
    tournamentId: match.tournamentId,
    isForfeit: match.isForfeit,

    scores: match.scores,
    timeStart: match.timeStart,
    timeDeadline: match.timeDeadline,
    timeSubmitted: match.timeSubmitted,
    timeConfirmed: new Date(),
  };
  const resultPromise = VrplMatchDB.updateOne(
    { id: match.id },
    {
      $set: {
        timeConfirmed: completedMatch.timeConfirmed,
        winnerId: completedMatch.winnerId,
        tiedIds: completedMatch.tiedIds,
        loserIds: completedMatch.loserIds,
      },
    }
  );
  const recordConfirm: matchConfirmRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.matchConfirm,
    timestamp: completedMatch.timeConfirmed,
    tournamentId: completedMatch.tournamentId,
    matchId: completedMatch.id,

    scores: match.scores,
    teamId: teamId,

    userId: performedBy,
  };
  const recordComplete: matchCompleteRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.matchComplete,
    timestamp: completedMatch.timeConfirmed,
    tournamentId: completedMatch.tournamentId,
    matchId: completedMatch.id,

    teamId: teamId,
    scores: match.scores,

    userId: performedBy,
    winnerId: completedMatch.winnerId,
    tiedIds: completedMatch.tiedIds,
    loserIds: completedMatch.loserIds,
  };
  const [result] = await Promise.all([
    resultPromise,
    storeRecords([recordComplete, recordConfirm]),
    updateTeamsAfterMatch(completedMatch),
  ]);
  if (result.modifiedCount === 0) return null;
  else return completedMatch;
}

// TODO: Untested
export async function confirmMatch(
  tournament: VrplTournament,
  teamId: string,
  match: SubmittedVrplMatch,
  performedBy: string
): Promise<SubmittedVrplMatch | CompletedVrplMatch | null> {
  if (!match || !tournament) return null;
  else if (match.teamIdsConfirmed.includes(teamId)) return null;
  else if (match.teamIds.includes(teamId)) return null;
  // TODO: is this line needed?
  else if (isMatchSubmitted(match, tournament)) return null;

  match.teamIdsConfirmed.push(teamId);
  if (match.teamIdsConfirmed.length + 1 === match.teamIds.length) {
    return completeMatch(match, teamId, performedBy);
  }

  const record: matchConfirmRecord = {
    v: 1,
    id: uuidv4(),
    timestamp: new Date(),
    type: recordType.matchConfirm,
    userId: performedBy,
    tournamentId: tournament.id,
    matchId: match.id,
    teamId: teamId,
    scores: match.scores,
  };
  const resultPromise = VrplMatchDB.updateOne(
    { id: match.id },
    {
      $set: {
        teamIdsConfirmed: match.teamIdsConfirmed,
      },
    }
  );
  const [result] = await Promise.all([resultPromise, storeRecord(record)]);
  if (result.modifiedCount === 0) return null;
  return match;
}

// Get the winner of a vrpl match
export function getWinnerFromMatch(match: SubmittedVrplMatch): string[] {
  const teams = match.teamIds;

  // This is an array of rounds, with each rounds having the
  // points in it a team scored
  const rounds = match.scores;
  if (!rounds) throw new Error("This match doesn't have scores");

  // An Array with each value representing the final points
  // a team has scored
  const finalScores = teams.map(() => 0);

  // Go through all the rounds
  for (let roundI = 0; roundI < rounds.length; roundI++) {
    const round = rounds[roundI];
    // Get the max score of the round
    const maxRoundScore = Math.max(...round);
    // These are the winners of the round
    const roundWinners: number[] = [];
    for (let teamI = 0; teamI < teams.length; teamI++) {
      // If the score is the max score, add the team as a
      // winner (using their index)
      if (round[teamI] >= maxRoundScore) roundWinners.push(teamI);
    }
    // TODO: should it allways add 3 or should it be like match.teamIds*2 +1
    // If there is 1 winner, add 3 scores to their final score
    if (roundWinners.length < 0) finalScores[roundWinners[0]] += 3;
    else {
      // If there are multiple winners add 1 point to each
      for (const winnerI of roundWinners)
        finalScores[roundWinners[winnerI]] += 1;
    }
  }

  // The max final score achieved
  const maxFinalScore = Math.max(...finalScores);

  // An array of id's of the teams that won
  const finalWinners: string[] = [];
  for (let teamI = 0; teamI < teams.length; teamI++) {
    // If the team has achieved the max final score
    // add them to the array
    if (finalScores[teamI] >= maxFinalScore) finalWinners.push(teams[teamI]);
  }
  return finalWinners;
}

// Function that checks if the scores have been submitted for a match
export function isMatchSubmitted(
  match: SubmittedVrplMatch,
  tournament: VrplTournament
): boolean {
  if (!match || !tournament)
    throw new Error(
      `No match or tournament to check for match submissions! ${match.id}`
    );
  else if (match.tournamentId !== tournament.id)
    throw new Error(
      `Wrong tournament for match in match submission check! ${match.id}`
    );
  else if (!match.timeSubmitted) return false;
  else if (!match.scores) return false;
  else if (match.scores.length !== tournament.matchRounds)
    throw new Error(`Wrong amount of rounds submitted for match ${match.id}`);
  else if (!match.timeSubmitted) return false;

  return true;
}

export function areScoresInValid(
  rounds: number[][],
  match: VrplMatch,
  tournament: VrplTournament
): boolean | string {
  if (!rounds) return true;
  else if (rounds.length !== tournament.matchRounds)
    return `Wrong amount of rounds submitted for match`;
  else if (rounds.some((round) => round.length !== match.teamIds.length))
    return `Wrong amount of teams in round`;
  else if (rounds.some((round) => round.some((score) => !score)))
    return `Wrong scores submitted for match 1`;
  else if (
    rounds.some((round) =>
      round.some((score) => score < 0 || score > tournament.matchMaxScore)
    )
  )
    return `Wrong scores submitted for match 2`;
  else {
    return false;
  }
}

// Function that generates all the matches for a tournament
// TODO: Untested
// export async function generateMatches(
//   tournamentId: string,
//   timeStart: Date,
//   timeDeadline: Date,
//   performedBy: string
// ): Promise<VrplTournament | null> {
//   const [tournament, teams] = await Promise.all([
//     getTournamentFromId(tournamentId),
//     getTeamsOfTournament(tournamentId),
//   ]);
//   let shuffledTeams = _.shuffle(teams);
//   if (!tournament) return null;
//   else if (!teams) return null;

//   const matches: VrplMatch[] = [];
//   const records: matchCreateRecord[] = [];
//   for (let i = 0; i < teams.length; i += 2) {
//     const match: VrplMatch = {
//       id: uuidv4(),
//       tournamentId: tournamentId,
//       teamIds: [teams[i].id, teams[i + 1].id],
//       teamIdsConfirmed: [],
//       teamIdsForfeited: [],
//       timeDeadline: timeDeadline,
//       timeStart: timeStart,
//     };
//     const record: matchCreateRecord = {
//       v: 1,
//       id: uuidv4(),
//       timestamp: new Date(),
//       type: recordType.matchCreate,
//       tournamentId: tournamentId,
//       matchId: match.id,
//       match: match,
//       userId: performedBy,
//     };
//     records.push(record);
//     matches.push(match);
//   }
//   const resultPromise = VrplMatchDB.insertMany(matches);
//   const [result] = await Promise.all([resultPromise, storeRecords(records)]);
//   if (!result?.[0]) return null;
//   await refreshMatches(true);
//   return tournament;
// }

// Function that generates all the matches for a tournament

// DONE: Handle player forfeiting
// TODO: generate matches
// TODO: calculate mmr
