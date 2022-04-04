import { convertSiteInput } from "../utils/regex/general";
import VrplTournamentDB, { VrplTournament } from "./models/vrplTournaments";
import { getAllSeededTeams } from "./team";
import { range } from "lodash";
import { BadRequestError, InternalServerError } from "../utils/errors";
import { SeededVrplTeam } from "./models/vrplTeam";

export async function getAllTournaments() {
  return VrplTournamentDB.find().exec();
}

export async function getTournamentFromName(tournamentName: string) {
  const tournaments = await getAllTournaments();
  return (
    tournaments.find(
      (tournament) =>
        convertSiteInput(tournament.name) === convertSiteInput(tournamentName)
    ) || null
  );
}

export async function getTournamentFromId(tournamentId: string) {
  return VrplTournamentDB.findOne({
    id: tournamentId,
  }).exec();
}

export async function getTournamentIdFromName(
  name: string
): Promise<string | null> {
  const tournament = await getTournamentFromName(name);
  if (tournament) return tournament.id;
  return null;
}

export async function getTournamentsOfGame(gameId: string) {
  return VrplTournamentDB.find({
    gameId: gameId,
  }).exec();
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
