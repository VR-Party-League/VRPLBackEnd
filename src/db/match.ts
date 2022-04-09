import VrplMatchDB, {
  CompletedVrplMatch,
  isSubmitted,
  PlainVrplMatch,
  SubmittedVrplMatch,
  VrplMatch,
} from "../db/models/vrplMatch";
import { v4 as uuidv4 } from "uuid";
import { VrplTournament } from "./models/vrplTournaments";
import {
  matchCompleteRecord,
  matchConfirmRecord,
  matchSubmitRecord,
} from "./models/records/matchRecords";
import { recordType } from "./models/records";
import { storeAndBroadcastRecord, storeAndBroadcastRecords } from "./records";
import { getTeamsFromSeeds, updateTeamsAfterMatch } from "./team";
import { SeededVrplTeam } from "./models/vrplTeam";
import { BadRequestError, InternalServerError } from "../utils/errors";

export async function getMatchFromId(
  tournamentId: string,
  matchId: string
): Promise<null | VrplMatch> {
  const match = await VrplMatchDB.findOne({
    tournamentId: tournamentId,
    id: matchId,
  });
  return match;
}

export async function getMatchesForTeam(
  tournamentId: string,
  teamId: string,
  recentOnly: boolean = true
) {
  const aWeekLater = new Date();
  aWeekLater.setDate(aWeekLater.getDate() + 7);
  const aWeekAgo = new Date();
  aWeekAgo.setDate(aWeekAgo.getDate() - 7);
  return VrplMatchDB.find({
    tournamentId: tournamentId,
    teamIds: teamId,
    $or: [
      { timeDeadline: recentOnly ? { $lt: aWeekLater } : undefined },
      { timeStart: recentOnly ? { $gt: aWeekAgo } : undefined },
    ],
  });
}

export async function getMatchesOfTournament(
  tournamentId: string
): Promise<VrplMatch[]> {
  return VrplMatchDB.find({ tournamentId: tournamentId });
}

export async function getCurrentMatchesOfTournament(
  tournamentId: string
): Promise<VrplMatch[]> {
  const now = new Date();
  return VrplMatchDB.find({
    tournamentId: tournamentId,
    timeDeadline: { $lt: now },
    timeStart: { $gt: now },
  });
}

// Function that submits scores for a match
// TODO: Untested
export async function submitMatch(
  tournament: VrplTournament,
  match: SubmittedVrplMatch | VrplMatch,
  team: SeededVrplTeam,
  scores: number[][],
  performedBy: string,
  isForfeit?: boolean,
  force?: boolean
): Promise<SubmittedVrplMatch | null> {
  if (!match || !tournament) return null;
  else if (!force && isMatchSubmitted(match, tournament))
    throw new BadRequestError("Match submitted already");
  else if (areScoresInvalid(scores, match, tournament))
    throw new BadRequestError("Invalid match scores");
  else if (!force && Date.now() < match.timeStart.getTime())
    throw new BadRequestError("Match not started yet");
  else if (!force && Date.now() > match.timeDeadline.getTime())
    throw new BadRequestError("Deadline for match reached");
  const timeSubmitted = new Date();

  const submitterTeamSeed = team.seed;

  const winData = getWinningSeedsForMatch(match, scores);
  let winnerSeed: number | undefined;
  let tiedSeeds: number[] = [];
  let lostSeeds: number[] = [];
  if (winData.length > 1) tiedSeeds = winData;
  else if (winData.length === 1) winnerSeed = winData[0];
  else if (winData.length === 0) lostSeeds = match.teamSeeds;
  for (const seed of match.teamSeeds) {
    let isTeamWinner = submitterTeamSeed === winnerSeed;
    let hasTeamTied = tiedSeeds.includes(submitterTeamSeed);
    let hasTeamLost = lostSeeds.includes(submitterTeamSeed);
    if (isTeamWinner || hasTeamTied || hasTeamLost) continue;
    lostSeeds.push(seed);
  }

  const teams = await getTeamsFromSeeds(tournament.id, match.teamSeeds);

  const winner =
    winnerSeed !== undefined
      ? teams.find((team) => team.seed === winnerSeed)
      : undefined;
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
    tournamentName: tournament.name,
    matchId: match.id,
    teamId: team.id,
    teamSeed: team.seed,
    userId: performedBy,
    scores: scores,
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
 * @param {SubmittedVrplMatch} match the match to confirm and complete
 * @param {string} team the team that will be the final team to confirm the match
 * @param {string} performedBy the user that confirmed the match
 * @param {boolean} force ignore any checks
 * @returns CompletedVrplMatch | null
 */
export async function completeMatch(
  match: SubmittedVrplMatch,
  team: SeededVrplTeam,
  performedBy: string,
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
    { id: match.id },
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

    matchId: completedMatch.id,

    scores: match.scores,
    teamId: team.id,
    teamSeed: team.seed,
    userId: performedBy,
  };
  const recordComplete: matchCompleteRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.matchComplete,
    timestamp: completedMatch.timeConfirmed,
    tournamentId: completedMatch.tournamentId,
    matchId: completedMatch.id,

    teamId: team.id,
    teamSeed: team.seed,
    scores: match.scores,

    userId: performedBy,
    winnerId: completedMatch.winnerId,
    tiedIds: completedMatch.tiedIds,
    loserIds: completedMatch.loserIds,
  };
  const [result] = await Promise.all([
    resultPromise,
    storeAndBroadcastRecords([recordConfirm, recordComplete]),
    updateTeamsAfterMatch(completedMatch),
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
  match: SubmittedVrplMatch,
  performedById: string,
  force?: boolean
): Promise<SubmittedVrplMatch> {
  if (!match || !tournament)
    throw new InternalServerError("Invalid match or tournament");
  else if (match.seedsConfirmed.includes(team.seed))
    throw new BadRequestError("This team has already confirmed this match");
  else if (!force && !match.teamSeeds.includes(team.seed))
    throw new BadRequestError("This team is not playing in this match");

  match.seedsConfirmed.push(team.seed);
  if (match.seedsConfirmed.length === match.seedsConfirmed.length - 1) {
    return completeMatch(match, team, performedById, force);
  }

  const record: matchConfirmRecord = {
    v: 1,
    id: uuidv4(),
    timestamp: new Date(),
    type: recordType.matchConfirm,
    userId: performedById,
    tournamentId: tournament.id,
    matchId: match.id,
    teamId: team.id,
    teamSeed: team.seed,
    scores: match.scores,
  };
  const resultPromise = VrplMatchDB.updateOne(
    { id: match.id },
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

// Get the winner of a vrpl match
export function getWinningSeedsForMatch(
  match: PlainVrplMatch,
  scores: number[][]
): number[];
export function getWinningSeedsForMatch(match: SubmittedVrplMatch): number[];
export function getWinningSeedsForMatch(
  match: SubmittedVrplMatch | PlainVrplMatch,
  scores?: number[][]
): number[] {
  const teamSeeds = match.teamSeeds;
  // TODO: FIX THIS SO IT WORKS
  // This is an array of rounds, with each rounds having the
  // points in it a team scored
  let rounds = scores;
  if (!rounds) {
    if (!isSubmitted(match))
      throw new Error(
        "Cannot get winner from a non-submitted match if no score entered, dummy"
      );
    rounds = rounds || match.scores;
  }
  if (!rounds) throw new Error("This match doesn't have scores");

  // An Array with each value representing the final points
  // a team has scored
  const finalScores = teamSeeds.map(() => 0);

  // Go through all the rounds
  for (let roundI = 0; roundI < rounds.length; roundI++) {
    const round = rounds[roundI];
    // Get the max score of the round
    const maxRoundScore = Math.max(...round);
    // These are the winners of the round
    const roundWinners: number[] = [];
    for (let teamI = 0; teamI < teamSeeds.length; teamI++) {
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
  const finalWinners: number[] = [];
  for (let teamI = 0; teamI < teamSeeds.length; teamI++) {
    // If the team has achieved the max final score
    // add them to the array
    if (finalScores[teamI] >= maxFinalScore)
      finalWinners.push(teamSeeds[teamI]);
  }
  return finalWinners;
}

// Function that checks if the scores have been submitted for a match
export function isMatchSubmitted(
  match: VrplMatch,
  tournament: VrplTournament
): boolean {
  if (!isSubmitted(match)) return false;
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

export function areScoresInvalid(
  rounds: number[][],
  match: VrplMatch,
  tournament: VrplTournament
): boolean | string {
  if (!rounds) return true;
  else if (rounds.length !== tournament.matchRounds)
    return `Wrong amount of rounds submitted for match`;
  else if (rounds.some((round) => round.length !== match.teamSeeds.length))
    return `Wrong amount of teams in round`;
  // else if (rounds.some((round) => round.some((score) => score < 0)))
  //   throw `Wrong scores submitted, `;
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

/*
Server error: Error: No response from submitting match: 
{"$__":{"activePaths":{"paths":{"id":"init","teamIds":"init","teamIdsConfirmed":"default","scores":"default","tiedIds":"default","loserIds":"default","_id":"init","tournamentId":"init","timeStart":"init","timeDeadline":"init"},"states":{"ignore":{},"default":{"teamIdsConfirmed":true,"scores":true,"tiedIds":true,"loserIds":true},"init":{"_id":true,"id":true,"tournamentId":true,"teamIds":true,"timeStart":true,"timeDeadline":true},"modify":{},"require":{}},"stateNames":["require","modify","init","default","ignore"]},"emitter":{"_events":{},"_eventsCount":0,"_maxListeners":0},"$options":{"skipId":true,"isNew":false,"willInit":true,"defaults":true},"strictMode":true,"selected":{},"_id":"61a23372fc04b6f35121e649"},"$isNew":false,"$op":null,"_doc":{"teamIdsConfirmed":[],"scores":[],"tiedIds":[],"loserIds":[],"_id":"61a23372fc04b6f35121e649","id":"a256s194-7d45-4e12-bffb-d8e02f75d6d0","tournamentId":"f3d4a8be-7d45-4e12-bffb-ba678bd59abb","teamIds":["b178c694-4623-425b-8481-d8e02f75d6d0","c289b705-4623-425b-8481-d8e02f75d6d0"],"timeStart":"2021-09-06T15:53:00.000Z","timeDeadline":"2021-12-06T15:53:00.000Z"},"$init":true,"submitterTeamId":"b178c694-4623-425b-8481-d8e02f75d6d0","teamIdsConfirmed":[],"scores":[[10,0],[0,10],[11,5]],"timeSubmitted":"2021-11-30T16:48:52.554Z","isForfeit":false,"tiedIds":[],"loserIds":["b178c694-4623-425b-8481-d8e02f75d6d0","c289b705-4623-425b-8481-d8e02f75d6d0","b178c694-4623-425b-8481-d8e02f75d6d0","c289b705-4623-425b-8481-d8e02f75d6d0"] 
{
  "$__": {
    "activePaths": {
      "paths": {
        "id": "init",
        "teamIds": "init",
        "teamIdsConfirmed": "default",
        "scores": "default",
        "tiedIds": "default",
        "loserIds": "default",
        "_id": "init",
        "tournamentId": "init",
        "timeStart": "init",
        "timeDeadline": "init"
      },
      "states": {
        "ignore": {},
        "default": {
          "teamIdsConfirmed": true,
          "scores": true,
          "tiedIds": true,
          "loserIds": true
        },
        "init": {
          "_id": true,
          "id": true,
          "tournamentId": true,
          "teamIds": true,
          "timeStart": true,
          "timeDeadline": true
        },
        "modify": {},
        "require": {}
      },
      "stateNames": [
        "require",
        "modify",
        "init",
        "default",
        "ignore"
      ]
    },
    "emitter": {
      "_events": {},
      "_eventsCount": 0,
      "_maxListeners": 0
    },
    "$options": {
      "skipId": true,
      "isNew": false,
      "willInit": true,
      "defaults": true
    },
    "strictMode": true,
    "selected": {},
    "_id": "61a23372fc04b6f35121e649"
  },
  "$isNew": false,
  "$op": null,
  "_doc": {
    "teamIdsConfirmed": [],
    "scores": [],
    "tiedIds": [],
    "loserIds": [],
    "_id": "61a23372fc04b6f35121e649",
    "id": "a256s194-7d45-4e12-bffb-d8e02f75d6d0",
    "tournamentId": "f3d4a8be-7d45-4e12-bffb-ba678bd59abb",
    "teamIds": [
      "b178c694-4623-425b-8481-d8e02f75d6d0",
      "c289b705-4623-425b-8481-d8e02f75d6d0"
    ],
    "timeStart": "2021-09-06T15:53:00.000Z",
    "timeDeadline": "2021-12-06T15:53:00.000Z"
  },
  "$init": true,
  "submitterTeamId": "b178c694-4623-425b-8481-d8e02f75d6d0",
  "teamIdsConfirmed": [],
  "scores": [
    [
      10,
      0
    ],
    [
      0,
      10
    ],
    [
      11,
      5
    ]
  ],
  "timeSubmitted": "2021-11-30T16:48:52.554Z",
  "isForfeit": false,
  "tiedIds": [],
  "loserIds": [
    "b178c694-4623-425b-8481-d8e02f75d6d0",
    "c289b705-4623-425b-8481-d8e02f75d6d0",
    "b178c694-4623-425b-8481-d8e02f75d6d0",
    "c289b705-4623-425b-8481-d8e02f75d6d0"
  ]
}

*/
