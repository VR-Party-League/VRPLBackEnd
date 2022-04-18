import VrplMatchDB, { VrplMatch } from "../models/vrplMatch";

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
  teamSeed: number,
  recentOnly: boolean = true
) {
  const aWeekLater = new Date();
  aWeekLater.setDate(aWeekLater.getDate() + 7);
  const aWeekAgo = new Date();
  aWeekAgo.setDate(aWeekAgo.getDate() - 7);
  return VrplMatchDB.find({
    tournamentId: tournamentId,
    teamSeeds: teamSeed,
    $or: [
      { timeDeadline: recentOnly ? { $lt: aWeekLater } : undefined },
      { timeStart: recentOnly ? { $gt: aWeekAgo } : undefined },
    ],
  });
}

export async function getMatchesOfTournament(tournamentId: string) {
  return VrplMatchDB.find({ tournamentId: tournamentId });
}

export async function getCurrentMatchesOfTournament(tournamentId: string) {
  const now = new Date();
  return VrplMatchDB.find({
    tournamentId: tournamentId,
    timeDeadline: { $gt: now },
    timeStart: { $lt: now },
  });
}
