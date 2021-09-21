import ms from "ms";
import { convertSiteInput } from "../utils/regex/general";
import { TournamentModel, VrplTournament } from "./models/vrplTournaments";
//import { getTeamsOfTournament } from "./team";
const tournamentCache = new Map<string, VrplTournament>();
let cacheTimestamp: number = 0;

let fetchingTournaments: undefined | Promise<any> | PromiseLike<any> =
  undefined;

function storeTournament(tournament: VrplTournament) {
  const data: VrplTournament = {
    id: tournament.id,
    type: tournament.type,
    name: tournament.name,
    description: tournament.description,
    summary: tournament.summary,
    banner: tournament.banner,
    icon: tournament.icon,
    gameId: tournament.gameId,

    matchIds: new Array(...tournament.matchIds),
    currentMatchIds: tournament.currentMatchIds
      ? new Array(...tournament.currentMatchIds)
      : [],

    matchRounds: tournament.matchRounds,
    matchMaxScore: tournament.matchMaxScore,
    rules: tournament.rules,

    eligibilityCheck: tournament.eligibilityCheck,
    region: tournament.region,

    start: new Date(tournament.start),
    end: new Date(tournament.end),
    registrationStart: new Date(tournament.registrationStart),
    registrationEnd: new Date(tournament.registrationEnd),
  };

  tournamentCache.set(data.id, data);
  return data;
}
async function reCacheTournaments(): Promise<void> {
  cacheTimestamp = Date.now();
  const tournaments = await TournamentModel.find({});
  tournamentCache.clear();
  for (let tournament of tournaments) {
    //const Teams = await getTeamsOfTournament(tournament.id);
    // Make sure the teams in the tournament are correct!
    storeTournament(tournament);
  }
}
export async function refreshTournaments(opts?: {
  force: boolean;
}): Promise<void> {
  if (fetchingTournaments) await fetchingTournaments;
  if (cacheTimestamp + ms("60min") < Date.now() || opts?.force) {
    fetchingTournaments = new Promise<void>(async (resolve, reject) => {
      await reCacheTournaments();
      resolve();
      fetchingTournaments = undefined;
    });
    await fetchingTournaments;
  } else if (cacheTimestamp + ms("1min") < Date.now()) {
    Promise.resolve(reCacheTournaments());
  }
}
// export async function addTeamToTournamentCache(team: VrplTeam) {
//   if (!team) throw new Error("No team entered");
//   let cachedTournament = tournamentCache.get(team.Tournament);
//   if (!cachedTournament) {
//     await refreshTournaments({ force: true });
//     cachedTournament = tournamentCache.get(team.Tournament);
//   }
//   if (!cachedTournament)
//     throw new Error(
//       `Tournament '${team.Tournament}' not found, teamID: '${team.TeamID}'`
//     );
//   cachedTournament.Teams.push(team.TeamID);
// }
export async function getAllTournaments(): Promise<VrplTournament[]> {
  await refreshTournaments();
  const response = [];
  for (const tournament of tournamentCache.values()) response.push(tournament);
  return response;
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
  await refreshTournaments();
  return tournamentCache.get(tournamentId) || null;
}

export async function getTournamentsOfGame(gameId: string) {
  await refreshTournaments();
  const res: VrplTournament[] = [];
  for (let tournament of tournamentCache.values()) {
    if (tournament.gameId === gameId) res.push(tournament);
  }
  return res;
}
