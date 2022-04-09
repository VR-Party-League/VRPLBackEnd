import { convertSiteInput } from "../utils/regex/general";
import VrplTournamentDB, { VrplTournament } from "./models/vrplTournaments";
import { getAllSeededTeams } from "./team";
import { range } from "lodash";
import { BadRequestError, InternalServerError } from "../utils/errors";
import { SeededVrplTeam } from "./models/vrplTeam";

type tournamentId = string;
type tournamentName = string;
const tournamentNameCache = new Map<tournamentId, tournamentName>();

function updateTournamentNameCache(
  tournaments: (VrplTournament | null)[],
  clear: boolean = false
) {
  if (clear) tournamentNameCache.clear();
  for (const tournament of tournaments) {
    if (!tournament) continue;
    tournamentNameCache.set(tournament.id, tournament.name);
  }
}

export function getTournamentNameFromIdFromCache(tournamentId: string) {
  return tournamentNameCache.get(tournamentId);
}

export async function getAllTournaments() {
  const tournaments = await VrplTournamentDB.find({}).exec();
  updateTournamentNameCache(tournaments, true);
  return tournaments;
}

export async function getTournamentFromName(tournamentName: string) {
  const tournament = await VrplTournamentDB.findOne({
    $text: {
      $caseSensitive: false,
      $diacriticSensitive: false,
      // $language: 'en',
      $search: convertSiteInput(tournamentName),
    },
  }).exec();
  updateTournamentNameCache([tournament]);
  return tournament;
}

export async function getTournamentFromId(tournamentId: string) {
  const tournament = await VrplTournamentDB.findOne({
    id: tournamentId,
  }).exec();
  updateTournamentNameCache([tournament]);
  return tournament;
}

export async function getTournamentsOfGame(gameId: string) {
  const tournaments = await VrplTournamentDB.find({
    gameId: gameId,
  }).exec();
  updateTournamentNameCache(tournaments);
  return tournaments;
}

export async function generateRoundRobinForTournament(
  tournament: VrplTournament,
  rounds: number,
  offset: number = 0
) {
  const seededTeams = await getAllSeededTeams(tournament.id);
  const seeds = seededTeams.map((team) => team.seed).sort((a, b) => a - b);
  const matchesPerRound = Math.floor(seeds.length / 2);

  type round = [number, number][];
  const matches: round[] = [];

  for (let i of range(offset)) {
    const lastSeed = seeds.pop();
    const firstSeed = seeds.shift();
    if (lastSeed === undefined || firstSeed === undefined)
      throw new BadRequestError(
        "Not enough seeded teams to generate a round robin"
      );
    seeds.unshift(lastSeed);
    seeds.unshift(firstSeed);
  }

  for (let roundIndex of range(rounds)) {
    const round: round = [];
    // Rotate the seeds
    const lastSeed = seeds.pop();
    const firstSeed = seeds.shift();
    if (lastSeed === undefined || firstSeed === undefined)
      throw new BadRequestError(
        "Not enough seeded teams to generate a round robin"
      );
    seeds.unshift(lastSeed);
    seeds.unshift(firstSeed);
    for (let mathOfRound of range(matchesPerRound)) {
      const match: [number, number] = [
        seeds[mathOfRound * 2],
        seeds[mathOfRound * 2 + 1],
      ];
      round.push(match);
    }
    matches.push(round);
  }
  return {
    seeds: matches,
    matchups: assignTeamsToMatches(matches, seededTeams),
  };
}

// export async function generateSingleEliminationRound(
//   tournament: VrplTournament,
//   previousRounds: CompletedVrplMatch[][]
// ) {
//   const seededTeams = await getAllSeededTeams(tournament.id);
//   const seeds = seededTeams.map((team) => team.seed).sort((a, b) => a - b);
//   const matchesPerRound = Math.floor(seeds.length / 2);
//
//   type round = [number, number][];
//   const matches: round[] = [];
// }

function assignTeamsToMatches(
  matches: [number, number][][],
  teams: SeededVrplTeam[]
) {
  type newRound = [SeededVrplTeam, SeededVrplTeam][];
  const newMatches: newRound[] = [];
  for (let round of matches) {
    const newRound: newRound = [];
    for (let match of round) {
      const team1 = teams.find((team) => team.seed === match[0]);
      const team2 = teams.find((team) => team.seed === match[1]);
      if (team1 === undefined)
        throw new InternalServerError(
          `Could not find a team with the seed ${match[0]} `
        );
      else if (team2 === undefined)
        throw new InternalServerError(
          `Could not find a team with the seed ${match[1]} `
        );
      newRound.push([team1, team2]);
    }
    newMatches.push(newRound);
  }
  return newMatches;
}
