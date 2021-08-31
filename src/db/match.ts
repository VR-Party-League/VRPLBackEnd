import ms from "ms";
import VrplMatchDB, { VrplMatch } from "../db/models/vrplMatch";
import { v4 as uuidv4 } from "uuid";
import Match from "../schemas/Match";
import { VrplTournament } from "./models/vrplTournaments";
import { getTournamentFromId } from "./tournaments";
import {
  matchConfirmRecord,
  matchCreateRecord,
  matchForfeitRecord,
  matchSubmitRecord,
} from "./models/records/matchRecords";
import { recordType } from "./models/records";
import { storeRecord, storeRecords } from "./logs";
import { getTeamsOfTournament } from "./team";
import _ from "lodash";

let matchCacheTimeStamp: number = 0;
const matchCache = new Map<string, VrplMatch>();

let fetchingMatches: undefined | Promise<any> | PromiseLike<any> = undefined;

function storeMatch(rawMatch: VrplMatch) {
  const match: VrplMatch = {
    id: rawMatch.id,
    tournamentId: rawMatch.tournamentId,
    teamIds: [...rawMatch.teamIds],
    scores: rawMatch.scores
      ? [...rawMatch.scores.map((score) => [...score])]
      : undefined,

    teamIdsConfirmed: [...rawMatch.teamIdsConfirmed],
    teamIdsForfeited: [...rawMatch.teamIdsForfeited],

    timeStart: new Date(rawMatch.timeStart),
    timeDeadline: new Date(rawMatch.timeDeadline),

    timeConfirmed: rawMatch.timeConfirmed
      ? new Date(rawMatch.timeConfirmed)
      : undefined,
    timeSubmitted: rawMatch.timeSubmitted
      ? new Date(rawMatch.timeSubmitted)
      : undefined,
  };
  matchCache.set(match.id, match);
  return match;
}

export async function refreshMatches(force?: boolean): Promise<void> {
  if (fetchingMatches) await fetchingMatches;
  if (matchCacheTimeStamp + ms("1hour") < Date.now() || force) {
    matchCacheTimeStamp = Date.now();
    fetchingMatches = new Promise<void>(async (resolve, reject) => {
      const matches = await VrplMatchDB.find({});
      // TODO: Maybe only fetch active matches
      matchCache.clear();
      for (let rawMatch of matches) {
        storeMatch(rawMatch);
      }
      resolve();
      fetchingMatches = undefined;
    });
    await fetchingMatches;
  } else if (matchCacheTimeStamp + ms("15min") < Date.now()) {
    matchCacheTimeStamp = Date.now();
    VrplMatchDB.find({}).then((matches) => {
      matchCache.clear();
      for (let rawMatch of matches) {
        storeMatch(rawMatch);
      }
    });
  }
}

type findFunc = (Match: VrplMatch) => boolean | undefined | null;

async function findMatch(tournamentId: string, findFunc: findFunc) {
  await refreshMatches();
  const matchIterable = matchCache.values();
  for (const match of matchIterable) {
    if (match.tournamentId !== tournamentId) continue;
    else if (findFunc(match)) return match;
  }
}
async function filterMatches(tournamentId: string, findFunc: findFunc) {
  await refreshMatches();
  const matchIterable = matchCache.values();
  const response: VrplMatch[] = [];
  for (const match of matchIterable) {
    if (match.tournamentId !== tournamentId) continue;
    else if (findFunc(match)) response.push(match);
  }
  return response;
}

export async function getMatchFromId(
  tournamentId: string,
  matchId: string
): Promise<VrplMatch | null> {
  await refreshMatches();
  const match = matchCache.get(matchId);
  if (!match || match.tournamentId !== tournamentId) return null;
  return match;
}

export async function getMatchesForTeam(
  tournamentId: string,
  teamId: string,
  activeOnly?: boolean
) {
  return await filterMatches(tournamentId, (match) => {
    if (match.teamIds.includes(teamId)) {
      if (activeOnly && match.timeDeadline.getTime() < Date.now()) return false;
      return true;
    }
    return false;
  });
}

// Function that submits scores for a match
// TODO: Untested
export async function submitMatch(
  tournamentId: string,
  matchId: string,
  teamId: string,
  scores: number[][],
  performedBy: string,
  force?: boolean
): Promise<VrplMatch | null> {
  const [match, tournament] = await Promise.all([
    getMatchFromId(tournamentId, matchId),
    getTournamentFromId(tournamentId),
  ]);
  if (!match || !tournament) return null;
  else if (!force && isMatchSubmitted(match, tournament)) return null;
  else if (!areScoresInValid(scores, match, tournament)) return null;
  else if (!force && match.timeStart.getTime() > Date.now()) return null;
  else if (!force && match.timeDeadline.getTime() < Date.now()) return null;

  if (match.teamIdsForfeited?.[0]) {
    for (const forfeitedTeamId of match.teamIdsForfeited) {
      if (forfeitedTeamId === teamId) return null;
      const IMatch = match.teamIds.indexOf(forfeitedTeamId);
      for (let IRound = 0; IRound < scores.length; IRound++) {
        scores[IRound][IMatch] = -1;
      }
    }
  }

  match.scores = scores;
  match.timeSubmitted = new Date();

  const resultPromise = VrplMatchDB.updateOne(
    { id: match.id },
    {
      $set: {
        scores: match.scores,
        timeSubmitted: match.timeSubmitted,
      },
    }
  );
  const record: matchSubmitRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.matchSubmit,
    timestamp: match.timeSubmitted,
    tournamentId: tournamentId,
    matchId: matchId,
    teamId: teamId,
    userId: performedBy,
    scores: match.scores,
  };
  const [result] = await Promise.all([resultPromise, storeRecord(record)]);
  if (result.nModified === 0) return null;
  else return match;
}

// TODO: Untested
export async function confirmMatch(
  tournamentId: string,
  teamId: string,
  matchId: string,
  performedBy: string
): Promise<VrplMatch | null> {
  const [match, tournament] = await Promise.all([
    getMatchFromId(tournamentId, matchId),
    getTournamentFromId(tournamentId),
  ]);
  if (!match || !tournament) return null;
  else if (match.teamIdsConfirmed.includes(teamId)) return null;
  else if (match.teamIds.includes(teamId)) return null;
  else if (!match.scores) return null;
  else if (isMatchSubmitted(match, tournament)) return null;
  else if (match.timeConfirmed) return null;

  match.teamIdsConfirmed.push(teamId);
  if (match.teamIdsConfirmed.length + 1 === match.teamIds.length) {
    match.timeConfirmed = new Date();
  }

  const record: matchConfirmRecord = {
    v: 1,
    id: uuidv4(),
    timestamp: match.timeConfirmed || new Date(),
    type: recordType.matchConfirm,
    userId: performedBy,
    tournamentId: tournamentId,
    matchId: matchId,
    teamId: teamId,
    scores: match.scores,
  };
  const resultPromise = VrplMatchDB.updateOne(
    { id: matchId },
    {
      $set: {
        teamIdsConfirmed: match.teamIdsConfirmed,
        timeConfirmed: match.timeConfirmed,
      },
    }
  );
  const [result] = await Promise.all([resultPromise, storeRecord(record)]);
  if (result.nModified === 0) return null;
  return match;
}

// Function that checks if the scores have been submitted for a match
export function isMatchSubmitted(
  match: VrplMatch,
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

// Function that forfeits a team from a match
// TODO: Untested
export async function forfeitMatch(
  tournamentId: string,
  matchId: string,
  teamId: string,
  performedBy: string,
  giveWin?: boolean
): Promise<VrplMatch | null> {
  const [match, tournament] = await Promise.all([
    getMatchFromId(tournamentId, matchId),
    getTournamentFromId(tournamentId),
  ]);
  if (!match || !tournament) return null;
  else if (match.teamIdsForfeited.includes(teamId)) return null;
  else if (!match.teamIds.includes(teamId)) return null;
  else if (match.scores || match.timeSubmitted) return null;

  const record: matchForfeitRecord = {
    v: 1,
    id: uuidv4(),
    timestamp: new Date(),
    type: recordType.matchForfeit,
    tournamentId: tournamentId,
    matchId: matchId,
    teamId: teamId,
    userId: performedBy,
  };
  const resultPromise = VrplMatchDB.updateOne(
    { id: matchId },
    {
      $set: {
        teamIdsForfeited: match.teamIdsForfeited,
      },
    }
  );
  match.teamIdsForfeited.push(teamId);
  const [result] = await Promise.all([resultPromise, storeRecord(record)]);
  if (result.nModified === 0) return null;

  if (match.teamIdsForfeited.length + 1 === match.teamIds.length && giveWin) {
    const scores: number[][] = [];
    for (let round = 0; round < tournament.matchRounds; round++) {
      scores.push(match.teamIds.map(() => 0));
    }
    console.log(
      "Submitting scores for match as enough teams have forfeited " + matchId
    );
    Promise.resolve().then(
      async () =>
        await submitMatch(tournamentId, matchId, teamId, scores, performedBy)
    );
  }
  return match;
}

// Function that generates all the matches for a tournament
// TODO: Untested
export async function generateMatches(
  tournamentId: string,
  timeStart: Date,
  timeDeadline: Date,
  performedBy: string
): Promise<VrplTournament | null> {
  const [tournament, teams] = await Promise.all([
    getTournamentFromId(tournamentId),
    getTeamsOfTournament(tournamentId),
  ]);
  let shuffledTeams = _.shuffle(teams);
  if (!tournament) return null;
  else if (!teams) return null;

  const matches: VrplMatch[] = [];
  const records: matchCreateRecord[] = [];
  for (let i = 0; i < teams.length; i += 2) {
    const match: VrplMatch = {
      id: uuidv4(),
      tournamentId: tournamentId,
      teamIds: [teams[i].id, teams[i + 1].id],
      teamIdsConfirmed: [],
      teamIdsForfeited: [],
      timeDeadline: timeDeadline,
      timeStart: timeStart,
    };
    const record: matchCreateRecord = {
      v: 1,
      id: uuidv4(),
      timestamp: new Date(),
      type: recordType.matchCreate,
      tournamentId: tournamentId,
      matchId: match.id,
      match: match,
      userId: performedBy,
    };
    records.push(record);
    matches.push(match);
  }
  const resultPromise = VrplMatchDB.insertMany(matches);
  const [result] = await Promise.all([resultPromise, storeRecords(records)]);
  if (!result?.[0]) return null;
  await refreshMatches(true);
  return tournament;
}

// Function that generates all the matches for a tournament

// DONE: Handle player forfeiting
// TODO: generate matches
// TODO: calculate mmr
