import { convertSiteInput } from "../utils/regex/general";
import VrplTournamentDB, {
  VrplTournament,
  VrplTournamentType,
} from "./models/vrplTournaments";
import { getAllSeededTeams } from "./team";
import { range } from "lodash";
import { BadRequestError, InternalServerError } from "../utils/errors";
import { SeededVrplTeam } from "./models/vrplTeam";
import { getGameById } from "./game";
import { v4 as uuidv4 } from "uuid";
import { tournamentCreateRecord } from "./models/records/tournamentRecords";
import { VrplAuth } from "..";
import { recordType } from "./models/records";
import { storeAndBroadcastRecord } from "./records";

type tournamentId = string;
type tournamentSlug = string;
const tournamentSlugCache = new Map<tournamentId, tournamentSlug>();

function updateTournamentSlugCache(
  tournaments: (VrplTournament | null)[],
  clear: boolean = false
) {
  if (clear) tournamentSlugCache.clear();
  for (const tournament of tournaments) {
    if (!tournament) continue;
    tournamentSlugCache.set(tournament.id, tournament.slug);
  }
}

export function getTournamentSlugFromIdFromCache(id: string) {
  return tournamentSlugCache.get(id);
}

export async function tournamentsFromIds(tournamentIds: string[]) {
  const tournaments = await VrplTournamentDB.find({
    id: { $in: tournamentIds },
  });
  updateTournamentSlugCache(tournaments);
  return tournaments;
}

export async function getAllTournaments() {
  const tournaments = await VrplTournamentDB.find({}).exec();
  updateTournamentSlugCache(tournaments, true);
  return tournaments;
}

export async function getTournamentFromSlug(slug: string) {
  // const tournament = await VrplTournamentDB.findOne({
  //   $text: {
  //     $caseSensitive: false,
  //     $diacriticSensitive: false,
  //     // $language: 'en',
  //     $search: convertSiteInput(tournamentName),
  //   },
  // }).exec();
  const sanitized = slug.replaceAll(
    "[-.\\+*?\\[^\\]$(){}=!<>|:\\\\]",
    "\\\\$0"
  );

  const tournament = await VrplTournamentDB.findOne({
    slug: { $regex: new RegExp(sanitized, "i") },
  });
  updateTournamentSlugCache([tournament]);
  return tournament;
}

export async function getTournamentFromId(tournamentId: string) {
  const tournament = await VrplTournamentDB.findOne({
    id: tournamentId,
  }).exec();
  updateTournamentSlugCache([tournament]);
  return tournament;
}

export async function getTournamentsOfGame(gameId: string) {
  const tournaments = await VrplTournamentDB.find({
    gameId: gameId,
  }).exec();
  updateTournamentSlugCache(tournaments);
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

export async function createTournament(
  tournament: {
    gameId: string;

    name: string;
    slug: string;
    description: string;
    summary: string;

    banner: string;
    icon: string;

    matchRounds: number;
    matchMaxScore: number;

    rules: string;

    registrationStart: Date;
    registrationEnd: Date;
    start: Date;
    end: Date;
  },
  auth: VrplAuth
) {
  const game = await getGameById(tournament.gameId);
  if (!game) throw new BadRequestError("Game does not exist");
  const newTournament = new VrplTournamentDB({
    id: uuidv4(),
    type: VrplTournamentType.RoundRobin,
    name: tournament.name,
    slug: tournament.slug,
    summary: tournament.summary,
    description: tournament.description,
    banner: tournament.banner,
    icon: tournament.icon,
    rules: tournament.rules,
    gameId: tournament.gameId,
    matchRounds: tournament.matchRounds,
    matchMaxScore: tournament.matchMaxScore,

    start: tournament.start,
    end: tournament.end,
    registrationStart: tournament.registrationStart,
    registrationEnd: tournament.registrationEnd,
  });
  await newTournament.save();
  const record: tournamentCreateRecord = {
    v: 1,
    id: uuidv4(),
    performedByUserId: auth.userId,
    performedByPlayerId: auth.playerId,
    type: recordType.tournamentCreate,
    timestamp: new Date(),

    tournamentId: newTournament.id,
    tournament: newTournament,
  };
  await storeAndBroadcastRecord(record);
  return newTournament;
}
