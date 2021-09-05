import ms from "ms";
import VrplTeamDB, {
  VrplTeam,
  VrplTeamPlayer,
  VrplTeamPlayerRole,
} from "../db/models/vrplTeam";
import * as Sentry from "@sentry/node";
import { v4 as uuidv4 } from "uuid";
import { storeRecord } from "./logs";
import {
  teamCreateRecord,
  teamPlayerCreateRecord,
  teamPlayerUpdateRecord,
  teamUpdateRecord,
} from "./models/records/teamRecordTypes";
import { recordType } from "./models/records";

let teamCacheTimeStamp: number = 0;
let teamCache: {
  [teamId: string]:
    | {
        [tournamentId: string]: VrplTeam | undefined;
      }
    | undefined;
} = {};
let fetchingTeams: undefined | Promise<any> | PromiseLike<any> = undefined;

function clearTeamCache() {
  // TODO: re-implement this
  teamCache = {};
}

function storeTeam(rawTeam: VrplTeam) {
  const team: VrplTeam = {
    id: rawTeam.id,
    name: rawTeam.name,
    ownerId: rawTeam.ownerId,
    teamPlayers: rawTeam.teamPlayers || [],
    tournamentId: rawTeam.tournamentId,
  };
  const teams = teamCache[team.id];
  if (teams) teams[team.tournamentId] = team;
  else teamCache[team.id] = { [team.tournamentId]: team };
  return team;
}

async function storeTeams(teams: VrplTeam[]) {
  clearTeamCache();
  for (let rawTeam of teams) {
    storeTeam(rawTeam);
  }
}

export async function refreshTeams(force?: boolean): Promise<void> {
  if (fetchingTeams) await fetchingTeams;
  if (teamCacheTimeStamp + ms("1hour") < Date.now() || force) {
    teamCacheTimeStamp = Date.now();
    fetchingTeams = new Promise<void>(async (resolve, reject) => {
      const teams = await VrplTeamDB.find({});
      storeTeams(teams);
      resolve();
      fetchingTeams = undefined;
    });
    await fetchingTeams;
  } else if (teamCacheTimeStamp + ms("15min") < Date.now()) {
    teamCacheTimeStamp = Date.now();
    VrplTeamDB.find({}).then((teams) => {
      storeTeams(teams);
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
    const team = teamCache[TeamID]?.[tournamentId];
    if (team && team?.tournamentId == tournamentId) return team || null;
  } catch (err) {
    console.trace();
    console.error(err);
    Sentry.captureException(err);
    return null;
  }
  return null;
}
type findFunc = (Team: VrplTeam) => boolean | undefined | null;
export async function findTeam(tournamentId: string, findFunc: findFunc) {
  await refreshTeams();
  const teamIterable = Object.values(teamCache);
  for (const teams of teamIterable) {
    const team = teams?.[tournamentId];
    if (!team) continue;
    else if (findFunc(team)) return team;
  }
  return null;
}
export async function filterTeams(tournamentId: string, filterFunc: findFunc) {
  await refreshTeams();
  const teamIterable = Object.values(teamCache);
  const response = [];
  for (const teams of teamIterable) {
    const team = teams?.[tournamentId];
    if (!team) continue;
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
      delete teamCache[team.id]?.[tournamentId];
      await VrplTeamDB.deleteOne({ id: team.id, tournamentId: tournamentId });
      return team;
    }
  } catch (err) {
    console.trace();
    console.error(err);
    Sentry.captureException(err);
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
  role: VrplTeamPlayerRole,
  performedBy: string
): Promise<VrplTeam | undefined> {
  const team = await getTeamFromId(tournamentId, teamId);
  if (!team) return;

  const teamPlayer: VrplTeamPlayer = {
    playerId: playerId,
    since: new Date(),
    role: role,
  };
  const filteredTeamPlayers = team.teamPlayers.filter(
    (teamPlayer) => teamPlayer.playerId !== playerId
  );
  let record: teamPlayerCreateRecord | teamPlayerUpdateRecord;
  if (filteredTeamPlayers.length !== team.teamPlayers.length) {
    const oldPlayer = team.teamPlayers.find(
      (teamPlayer) => teamPlayer.playerId === playerId
    );
    if (!oldPlayer)
      throw new Error("Could not find old version of updating team player!");
    record = {
      v: 1,
      id: uuidv4(),
      type: recordType.teamPlayerUpdate,
      tournamentId: team.tournamentId,
      userId: performedBy,
      teamId: team.id,
      playerId: teamPlayer.playerId,
      timestamp: new Date(),

      valueChanged: "role",
      old: oldPlayer.role,
      new: teamPlayer.role,
    };
  } else {
    record = {
      v: 1,
      id: uuidv4(),
      type: recordType.teamPlayerCreate,
      tournamentId: team.tournamentId,
      userId: performedBy,
      teamId: team.id,
      playerId: teamPlayer.playerId,
      timestamp: new Date(),

      role: teamPlayer.role,
    };
  }
  team.teamPlayers = filteredTeamPlayers;
  team.teamPlayers.push(teamPlayer);

  await Promise.all([
    VrplTeamDB.updateOne(
      { id: team.id },
      { $set: { teamPlayers: team.teamPlayers } }
    ),
    storeRecord(record),
  ]);
  return team;
}

// This function makes a new player the owner of a team.
export async function transferTeam(
  tournamentId: string,
  teamId: string,
  playerId: string,
  performedBy: string,
  oldOwnerRole?: VrplTeamPlayerRole
): Promise<VrplTeam | undefined> {
  const team = await getTeamFromId(tournamentId, teamId);
  if (!team) return;
  let changePlayersRecordPromise:
    | teamPlayerUpdateRecord
    | teamPlayerCreateRecord
    | undefined = undefined;
  if (oldOwnerRole) {
    const teamPlayer: VrplTeamPlayer = {
      playerId: playerId,
      role: oldOwnerRole,
      since: new Date(),
    };
    const filteredTeamPlayers = team.teamPlayers.filter(
      (teamPlayer) => teamPlayer.playerId !== playerId
    );
    if (filteredTeamPlayers.length !== team.teamPlayers.length) {
      const oldPlayer = team.teamPlayers.find(
        (teamPlayer) => teamPlayer.playerId === playerId
      );
      if (!oldPlayer)
        throw new Error(
          "Could not find old version of updating team player for transferring teams!"
        );
      changePlayersRecordPromise = {
        v: 1,
        id: uuidv4(),
        type: recordType.teamPlayerUpdate,
        userId: performedBy,
        tournamentId: team.tournamentId,
        teamId: team.id,
        playerId: teamPlayer.playerId,
        timestamp: new Date(),

        valueChanged: "role",
        old: oldPlayer.role,
        new: teamPlayer.role,
      };
    } else {
      changePlayersRecordPromise = {
        v: 1,
        id: uuidv4(),
        type: recordType.teamPlayerCreate,
        tournamentId: team.tournamentId,
        userId: performedBy,
        teamId: team.id,
        playerId: teamPlayer.playerId,
        timestamp: new Date(),

        role: teamPlayer.role,
      };
    }
    team.teamPlayers = filteredTeamPlayers;
    team.teamPlayers.push(teamPlayer);
  }
  const TeamUpdateRecord: teamUpdateRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.teamUpdate,
    tournamentId: team.tournamentId,
    userId: performedBy,
    teamId: team.id,
    timestamp: new Date(),
    valueChanged: "ownerId",
    new: playerId,
    old: `${team.ownerId}`,
  };
  team.ownerId = playerId;

  await Promise.all([
    VrplTeamDB.updateOne(
      { id: team.id },
      { $set: { ownerId: team.ownerId, teamPlayers: team.teamPlayers } }
    ),
    storeRecord(TeamUpdateRecord),
    changePlayersRecordPromise ? storeRecord(changePlayersRecordPromise) : null,
  ]);
  return team;
}

// Change the role of a player on a team.
export async function changeTeamPlayerRole(
  tournamentId: string,
  teamId: string,
  playerId: string,
  newRole: VrplTeamPlayerRole,
  performedBy: string
) {
  const team = await getTeamFromId(tournamentId, teamId);
  if (!team) return;
  const teamPlayer: VrplTeamPlayer = {
    playerId: playerId,
    since: new Date(),
    role: newRole,
  };
  const filteredTeamPlayers = team.teamPlayers.filter(
    (teamPlayer) => teamPlayer.playerId !== playerId
  );
  let record: teamPlayerCreateRecord | teamPlayerUpdateRecord;
  if (filteredTeamPlayers.length !== team.teamPlayers.length) {
    const oldPlayer = team.teamPlayers.find(
      (teamPlayer) => teamPlayer.playerId === playerId
    );
    if (!oldPlayer)
      throw new Error(
        "Could not find old version of updating team player for changing teamPlayer role!"
      );
    record = {
      v: 1,
      id: uuidv4(),
      type: recordType.teamPlayerUpdate,
      tournamentId: team.tournamentId,
      userId: performedBy,
      teamId: team.id,
      playerId: teamPlayer.playerId,
      timestamp: new Date(),

      valueChanged: "role",
      old: oldPlayer.role,
      new: teamPlayer.role,
    };
  } else {
    record = {
      v: 1,
      id: uuidv4(),
      type: recordType.teamPlayerCreate,
      tournamentId: team.tournamentId,
      userId: performedBy,
      teamId: team.id,
      playerId: teamPlayer.playerId,
      timestamp: new Date(),

      role: teamPlayer.role,
    };
  }
  team.teamPlayers = filteredTeamPlayers;
  team.teamPlayers.push(teamPlayer);

  await Promise.all([
    VrplTeamDB.updateOne(
      { id: team.id },
      { $set: { teamPlayers: team.teamPlayers } }
    ),
    storeRecord(record),
  ]);
  return team;
}

export async function removePlayerFromTeam(
  tournamentId: string,
  teamId: string,
  playerId: string,
  performedBy: string
): Promise<VrplTeam | undefined> {
  const team = await getTeamFromId(tournamentId, teamId);
  if (!team) return;

  const filteredTeamPlayers = team.teamPlayers.filter(
    (teamPlayer) => teamPlayer.playerId !== playerId
  );
  const removedTeamPlayer = team.teamPlayers.find(
    (player) => player.playerId === playerId
  );
  if (filteredTeamPlayers.length === team.teamPlayers.length)
    throw new Error(
      "Team player doesn't exist, and can therefore not be removed!"
    );
  else if (!removedTeamPlayer)
    throw new Error(
      "Blah blah error yippie, removePlayerFromTea me rr rrrr rrrrr cou ld nt find player to remove, but does exist? idk anymore"
    );
  const teamPlayer: VrplTeamPlayer = {
    playerId: playerId,
    role: VrplTeamPlayerRole.None,
    since: new Date(),
  };
  const TeamPlayerUpdate: teamPlayerUpdateRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.teamPlayerUpdate,
    tournamentId: team.tournamentId,
    userId: performedBy,
    teamId: team.id,
    playerId: teamPlayer.playerId,
    timestamp: new Date(),

    valueChanged: "role",
    old: removedTeamPlayer.role,
    new: teamPlayer.role,
  };

  team.teamPlayers = filteredTeamPlayers;
  team.teamPlayers.push(teamPlayer);

  await Promise.all([
    VrplTeamDB.updateOne(
      { id: team.id },
      { $set: { teamPlayers: team.teamPlayers } }
    ),
    storeRecord(TeamPlayerUpdate),
  ]);
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
  ownerId: string,
  performedBy: string
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
      return createTeam(tournamentId, teamName, ownerId, performedBy);
    }
    const goodTeam = storeTeam(teamData);
    const TeamModel = new VrplTeamDB(goodTeam);
    const TeamCreateRecord: teamCreateRecord = {
      id: uuidv4(),
      team: goodTeam,
      tournamentId: goodTeam.tournamentId,
      teamId: goodTeam.id,
      timestamp: new Date(),
      type: recordType.teamCreate,
      userId: performedBy,
      v: 1,
    };
    await Promise.all([storeRecord(TeamCreateRecord), TeamModel.save()]);

    return { success: true, doc: goodTeam };
  } catch (err) {
    console.trace();
    console.error(err);
    Sentry.captureException(err);
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
  for (const teams of Object.values(teamCache)) {
    if (!teams) continue;
    for (const team of Object.values(teams)) {
      if (!team) continue;
      if (
        team.teamPlayers.find((teamPlayer) => teamPlayer.playerId === playerId)
      ) {
        response.push(team);
      }
    }
  }
  return response;
}

export async function getAllTeamsFromId(teamId: string): Promise<VrplTeam[]> {
  // @ts-ignore
  return teamCache[teamId] ? Object.values(teamCache[teamId]) : [];
}
