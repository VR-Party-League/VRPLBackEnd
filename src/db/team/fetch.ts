import VrplTeamDB, {
  SeededVrplTeam,
  VrplTeam,
  VrplTeamPlayerRole,
} from "../models/vrplTeam";
import _ from "lodash";

export async function getTeamsOfTournament(tournamentId: string) {
  return VrplTeamDB.find({ tournamentId: tournamentId }).exec();
}

export async function getTeamFromId(
  tournamentId: string,
  teamId: string
): Promise<VrplTeam | null> {
  return await VrplTeamDB.findOne({
    tournamentId: tournamentId,
    id: teamId,
  }).exec();
}

export async function getTeamsFromIds(tournamentId: string, teamIds: string[]) {
  return (
    (await VrplTeamDB.find({
      tournamentId: tournamentId,
      id: { $in: teamIds },
    })) || []
  );
}

export async function getTeamFromSeed(tournamentId: string, seed: number) {
  return VrplTeamDB.findOne({
    tournamentId: tournamentId,
    seed: seed,
  });
}

export async function getTeamsFromSeeds(tournamentId: string, seeds: number[]) {
  return (await VrplTeamDB.find({
    tournamentId: tournamentId,
    seed: { $in: seeds.filter((seed) => typeof seed === "number") },
  }).exec()) as SeededVrplTeam[];
}

export async function getAllSeededTeams(tournamentId: string) {
  return (await VrplTeamDB.find({
    tournamentId: tournamentId,
    seed: { $exists: true },
  }).exec()) as SeededVrplTeam[];
}

export async function getTeamFromName(tournamentId: string, TeamName: string) {
  return VrplTeamDB.findOne({
    tournamentId: tournamentId,
    name: { $regex: new RegExp(`${_.escapeRegExp(TeamName)}`, "gi") },
  })
    .maxTimeMS(500)
    .exec();
}

// TODO: Test this
export async function getTeamsOfPlayer(
  tournamentId: string,
  playerId: string,
  role?: VrplTeamPlayerRole
): Promise<VrplTeam[]> {
  return VrplTeamDB.find({
    tournamentId: tournamentId,
    teamPlayers: { $elemMatch: { playerId: playerId, role: role } },
  });
}

// A function that returns all the teams of a player.
export async function getAllTeamsOfPlayer(
  playerId: string
): Promise<VrplTeam[]> {
  return await VrplTeamDB.find({
    $or: [
      { teamPlayers: { $elemMatch: { playerId: playerId } } },
      { ownerId: playerId },
    ],
  }).exec();
}
