import VrplMatchDB, {
  isSubmitted,
  PlainVrplMatch,
  SubmittedVrplMatch,
  VrplMatch,
} from "../models/vrplMatch";
import { VrplTournament } from "../models/vrplTournaments";
import { v4 as uuidv4 } from "uuid";

import { getTeamsFromSeeds } from "../team";
import { InternalServerError } from "../../utils/errors";
import { SeededVrplTeam } from "../models/vrplTeam";

export * from "./fetch";
export * from "./scores";

// Get the winner of a vrpl match
export function getWinningSeedsForMatch(
  teamSeeds: number[],
  // This is an array of rounds, with each rounds having the
  // points in it a team scored in that round
  rounds: number[][]
): number[] {
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
      if (round[teamI] == maxRoundScore) roundWinners.push(teamI);
    }
    // Should it always add 3 or should it be like match.teamIds*2 +1
    // If there is 1 winner, add 3 scores to their final score
    if (roundWinners.length === 1) finalScores[roundWinners[0]] += 3;
    else {
      // If there are multiple winners add 1 point to each
      for (const roundWinner of roundWinners) finalScores[roundWinner] += 1;
    }
  }

  // The max final score achieved
  const maxFinalScore = Math.max(...finalScores);
  // Create an array of seeds of the teams that won
  const finalWinners: number[] = [];
  for (let teamI = 0; teamI < teamSeeds.length; teamI++) {
    // If the team has achieved the max final score
    // add them to the array
    if (finalScores[teamI] == maxFinalScore)
      finalWinners.push(teamSeeds[teamI]);
  }
  return finalWinners.sort();
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

// DONE: Handle player forfeiting
// TODO: generate matches
// TODO: calculate mmr

type seed_match = { team1Seed: number; team2Seed: number };
type seed_round = {
  matches: seed_match[];
  start: Date;
  end: Date;
};

export async function createMatches(
  tournament: VrplTournament,
  seed_matches: seed_round[],
  submit?: boolean
) {
  const matches: VrplMatch[] = [];
  let seeds: number[] = [];
  for (const round of seed_matches) {
    for (const match of round.matches) {
      seeds.push(match.team1Seed);
      seeds.push(match.team2Seed);
    }
  }
  seeds = seeds.filter((value, index, self) => self.indexOf(value) === index);
  const teams = await getTeamsFromSeeds(tournament.id, seeds);

  for (let round of seed_matches) {
    for (let match of round.matches) {
      const team1 = teams.find((team) => team.seed === match.team1Seed);
      const team2 = teams.find((team) => team.seed === match.team2Seed);
      if (!team1)
        throw new InternalServerError(`Team 1 not found for match ${match}`);
      else if (!team2)
        throw new InternalServerError(`Team 2 not found for match ${match}`);
      matches.push(
        createMatch(tournament.id, team1, team2, round.start, round.end)
      );
    }
  }

  if (submit) {
    const res = await VrplMatchDB.insertMany(matches);
    return res.map((match) => match.toObject());
  }
  return matches;
}

function createMatch(
  tournamentId: string,
  team1: SeededVrplTeam,
  team2: SeededVrplTeam,
  start: Date,
  end: Date
) {
  const match: PlainVrplMatch = {
    id: uuidv4(),
    tournamentId: tournamentId,
    teamSeeds: [team1.seed, team2.seed],
    timeStart: start,
    timeDeadline: end,
  };
  return match;
}
