import ms from "ms";
import VrplTeamDB, {
  VrplTeam,
  VrplTeamPlayer,
  VrplTeamPlayerRole,
} from "../db/models/vrplTeam";
import { v4 as uuidv4 } from "uuid";

let teamCacheTimeStamp: number = 0;
const teamCache = new Map<string, VrplTeam>();

function storeTeam(rawTeam: VrplTeam) {
  const team: VrplTeam = {
    id: rawTeam.id,
    name: rawTeam.name,
    ownerId: rawTeam.ownerId,
    teamPlayers: rawTeam.teamPlayers || [],
    tournamentId: rawTeam.tournamentId,
  };
  teamCache.set(team.id, team);
  return team;
}

export async function refreshTeams(force?: boolean): Promise<void> {
  if (teamCacheTimeStamp + ms("1hour") < Date.now() || force) {
    teamCacheTimeStamp = Date.now();
    const teams = await VrplTeamDB.find({});
    teamCache.clear();
    for (let rawTeam of teams) {
      storeTeam(rawTeam);
    }
  } else if (teamCacheTimeStamp + ms("15min") < Date.now()) {
    teamCacheTimeStamp = Date.now();
    VrplTeamDB.find({}).then((teams) => {
      teamCache.clear();
      for (let rawTeam of teams) {
        storeTeam(rawTeam);
      }
    });
  }
}

export async function getTeamsOfTournament(
  tournamentId: string
): Promise<VrplTeam[]> {
  const Teams = await filterTeams(tournamentId, () => true);
  return Teams;
}
export async function getTeamFromId(
  tournamentId: string,
  TeamID: string
): Promise<VrplTeam | null> {
  try {
    await refreshTeams();
    const team = teamCache.get(TeamID);
    if (team && team?.tournamentId == tournamentId) return team || null;
  } catch (err) {
    console.trace();
    console.error(err);
    return null;
  }
  return null;
}
type findFunc = (Team: VrplTeam) => boolean | undefined | null;
export async function findTeam(tournamentId: string, findFunc: findFunc) {
  await refreshTeams();
  const teamIterable = teamCache.values();
  for (const team of teamIterable) {
    if (team.tournamentId !== tournamentId) continue;
    else if (findFunc(team)) return team;
  }
  return null;
}
export async function filterTeams(tournamentId: string, filterFunc: findFunc) {
  await refreshTeams();
  const teamIterable = teamCache.values();
  const response = [];
  for (const team of teamIterable) {
    if (team.tournamentId !== tournamentId) continue;
    else if (filterFunc(team)) response.push(team);
  }
  return response;
}
export async function getTeamFromName(
  tournamentId: string,
  TeamName: string
): Promise<VrplTeam | null> {
  return (
    (await findTeam(tournamentId, (team) => team.name === TeamName)) ||
    (await findTeam(
      tournamentId,
      (team) => team.name.toLowerCase() === TeamName.toLowerCase()
    ))
  );
}

export async function destroyTeam(
  tournamentId: string,
  TeamID: string
): Promise<VrplTeam | undefined> {
  try {
    const team = await getTeamFromId(tournamentId, TeamID);
    if (team && team?.tournamentId == tournamentId) {
      teamCache.delete(team.id);
      await VrplTeamDB.deleteOne({ id: team.id });
      return team;
    }
  } catch (err) {
    console.trace();
    console.error(err);
    return undefined;
  }
}

export async function findTeamsOfPlayer(
  tournamentId: string,
  playerId: string,
  role?: VrplTeamPlayerRole
): Promise<VrplTeam[]> {
  return await filterTeams(
    tournamentId,
    (team) =>
      !!team.teamPlayers.find((teamPlayer) =>
        teamPlayer.playerId === playerId && role
          ? teamPlayer.role === role
          : true
      )
  );
}

export async function addPlayerToTeam(
  tournamentId: string,
  teamId: string,
  playerId: string,
  role: VrplTeamPlayerRole
): Promise<VrplTeam | undefined> {
  const team = await getTeamFromId(tournamentId, teamId);
  if (!team) return;

  const teamPlayer: VrplTeamPlayer = {
    playerId: playerId,
    role: role,
  };
  team.teamPlayers = team.teamPlayers.filter(
    (teamPlayer) => teamPlayer.playerId !== playerId
  );
  team.teamPlayers.push(teamPlayer);
  await VrplTeamDB.updateOne(
    { id: team.id },
    { $set: { teamPlayers: team.teamPlayers } }
  );
  return team;
}

// This function makes a new player the owner of a team.
export async function transferTeam(
  tournamentId: string,
  teamId: string,
  playerId: string,
  oldOwnerRole?: VrplTeamPlayerRole
): Promise<VrplTeam | undefined> {
  const team = await getTeamFromId(tournamentId, teamId);
  if (!team) return;
  if (oldOwnerRole) {
    const teamPlayer: VrplTeamPlayer = {
      playerId: playerId,
      role: oldOwnerRole,
    };
    team.teamPlayers = team.teamPlayers.filter(
      (teamPlayer) => teamPlayer.playerId !== playerId
    );
    team.teamPlayers.push(teamPlayer);
  }
  team.ownerId = playerId;
  await VrplTeamDB.updateOne(
    { id: team.id },
    { $set: { ownerId: team.ownerId, teamPlayers: team.teamPlayers } }
  );
  return team;
}

// Change the role of a player on a team.
export async function changeTeamPlayerRole(
  tournamentId: string,
  teamId: string,
  playerId: string,
  newRole: VrplTeamPlayerRole
) {
  const team = await getTeamFromId(tournamentId, teamId);
  if (!team) return;
  const teamPlayer: VrplTeamPlayer = {
    playerId: playerId,
    role: newRole,
  };
  team.teamPlayers = team.teamPlayers.filter(
    (teamPlayer) => teamPlayer.playerId !== playerId
  );
  team.teamPlayers.push(teamPlayer);
  await VrplTeamDB.updateOne(
    { id: team.id },
    { $set: { teamPlayers: team.teamPlayers } }
  );
  return team;
}

export async function removePlayerFromTeam(
  tournamentId: string,
  teamId: string,
  playerId: string
): Promise<VrplTeam | undefined> {
  const team = await getTeamFromId(tournamentId, teamId);
  if (!team) return;

  team.teamPlayers = team.teamPlayers.filter(
    (teamPlayer) => teamPlayer.playerId !== playerId
  );
  await VrplTeamDB.updateOne(
    { id: team.id },
    { $set: { teamPlayers: team.teamPlayers } }
  );
  return team;
}

export async function getTeamPlayers(
  tournamentId: string,
  teamId: string
): Promise<VrplTeamPlayer[]> {
  const team = await getTeamFromId(tournamentId, teamId);
  if (!team) return [];
  return team.teamPlayers;
}

export async function getTeamPlayer(
  tournamentId: string,
  teamId: string,
  playerId: string
): Promise<VrplTeamPlayer | undefined> {
  const team = await getTeamFromId(tournamentId, teamId);
  if (!team) return;
  return team.teamPlayers.find(
    (teamPlayer) => teamPlayer.playerId === playerId
  );
}

export async function createTeam(
  tournamentId: string,
  teamName: string,
  ownerId: string
): Promise<
  { success: true; doc: VrplTeam } | { success: false; error: string }
> {
  try {
    const validatedTeamName = await validateTeamName(tournamentId, teamName);
    if (typeof validatedTeamName !== "string")
      return { success: false, error: validatedTeamName[0] };
    const teamData: VrplTeam = {
      ownerId: ownerId,
      id: uuidv4(),
      name: teamName,
      teamPlayers: [],
      tournamentId: tournamentId,
    };

    if (await getTeamFromId(tournamentId, teamData.id)) {
      return createTeam(tournamentId, teamName, ownerId);
    }
    const goodTeam = storeTeam(teamData);
    const TeamModel = new VrplTeamDB(goodTeam);
    await TeamModel.save();
    return { success: true, doc: goodTeam };
  } catch (err) {
    console.trace();
    console.error(err);
    return { success: false, error: "Internal server error" };
  }
}

export async function validateTeamName(
  Tournament: string,
  raw: any
): Promise<string | [string, (string | undefined)?]> {
  if (typeof raw !== "string") return ["TeamName is not a string"];

  let TeamName = raw
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/, "")
    .replace(/-+/, "-")
    .replace(/_+/, "_")
    .trim();
  if (!/^[\w-_\s]+$/.test(TeamName)) return ["Invalid name", TeamName];
  else if (TeamName.length < 5)
    return ["TeamName must at least be 5 characters long", TeamName];
  else if (TeamName.length > 25)
    return [
      "TeamName cannot be longer then 25 characters",
      // The name can actually be "longer then 25 characters" because it is 25 characters long! :D
      TeamName,
    ];

  // Check for other teams
  const existingTeamName = await getTeamFromName(Tournament, TeamName);

  if (existingTeamName) return ["Team name has been taken", TeamName];

  return TeamName;
}

// A function that returns all the teams of a player.
export async function getAllTeamsOfPlayer(
  playerId: string
): Promise<VrplTeam[]> {
  const response: VrplTeam[] = [];
  for (const team of teamCache.values()) {
    if (
      team.teamPlayers.find((teamPlayer) => teamPlayer.playerId === playerId)
    ) {
      response.push(team);
    }
  }
  return response;
}
