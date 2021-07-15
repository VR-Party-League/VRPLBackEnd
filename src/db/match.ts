import ms from "ms";
import VrplMatchDB, { VrplMatch } from "../db/models/vrplMatch";
import { v4 as uuidv4 } from "uuid";
import Match from "../schemas/Match";

let matchCacheTimeStamp: number = 0;
const matchCache = new Map<string, VrplMatch>();

function storeMatch(rawMatch: VrplMatch) {
  const match: VrplMatch = {
    id: rawMatch.id,
    tournamentId: rawMatch.tournamentId,
    teamIds: [...rawMatch.teamIds],
    scores: rawMatch.scores
      ? [...rawMatch.scores.map((score) => [...score])]
      : undefined,

    teamIdsConfirmed: [...rawMatch.teamIdsConfirmed],

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
  if (matchCacheTimeStamp + ms("1hour") < Date.now() || force) {
    matchCacheTimeStamp = Date.now();
    const matches = await VrplMatchDB.find({});
    matchCache.clear();
    for (let rawMatch of matches) {
      storeMatch(rawMatch);
    }
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
