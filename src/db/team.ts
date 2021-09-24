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
import { CompletedVrplMatch } from "./models/vrplMatch";

// TODO: add Sentry.captureException(err) to more places!

// TODO: Test this really does return an array, and not a cursor or whatever
export async function getTeamsOfTournament(
  tournamentId: string
): Promise<VrplTeam[]> {
  return VrplTeamDB.find({ tournamentId: tournamentId });
}
export async function getTeamFromId(
  tournamentId: string,
  teamId: string
): Promise<VrplTeam | null> {
  return (
    (await VrplTeamDB.findOne({
      tournamentId: tournamentId,
      id: teamId,
    })) || null
  );
}
export async function getTeamsFromIds(tournamentId: string, teamIds: string[]) {
  return (
    (await VrplTeamDB.find({
      tournamentId: tournamentId,
      id: { $in: teamIds },
    })) || []
  );
}
// export async function findTeam(tournamentId: string, findFunc: findFunc) {
//   await refreshTeams();
//   const teamIterable = Object.values(teamCache);
//   for (const teams of teamIterable) {
//     const team = teams?.[tournamentId];
//     if (!team) continue;
//     else if (findFunc(team)) return team;
//   }
//   return null;
// }
// export async function filterTeams(tournamentId: string, filterFunc: findFunc) {
//   await refreshTeams();
//   const teamIterable = Object.values(teamCache);
//   const response = [];
//   for (const teams of teamIterable) {
//     const team = teams?.[tournamentId];
//     if (!team) continue;
//     else if (filterFunc(team)) response.push(team);
//   }
//   return response;
// }
export async function getTeamFromName(
  tournamentId: string,
  TeamName: string
): Promise<VrplTeam | null> {
  return VrplTeamDB.findOne({
    tournamentId: tournamentId,
    name: { $regex: new RegExp(`${TeamName}`, "i") },
  });
}

export async function destroyTeam(
  tournamentId: string,
  TeamID: string
): Promise<void> {
  try {
    const deleted = await VrplTeamDB.deleteOne({
      id: TeamID,
      tournamentId: tournamentId,
    });
    if (deleted.deletedCount < 1) throw new Error("Did not delete document");
  } catch (err) {
    console.trace();
    console.error(err);
    Sentry.captureException(err);
  }
}

// TODO: Test this
export async function findTeamsOfPlayer(
  tournamentId: string,
  playerId: string,
  role?: VrplTeamPlayerRole
): Promise<VrplTeam[]> {
  return VrplTeamDB.find({
    tournamentId: tournamentId,
    teamPlayers: { $elemMatch: { playerId: playerId, role: role } },
  });
}

export async function addPlayerToTeam(
  tournamentId: string,
  team: VrplTeam,
  playerId: string,
  role: VrplTeamPlayerRole,
  performedBy: string
): Promise<VrplTeam | undefined> {
  if (!team?.id) return;

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
  team: VrplTeam,
  playerId: string,
  performedBy: string,
  oldOwnerRole?: VrplTeamPlayerRole
): Promise<VrplTeam | undefined> {
  if (!team?.id) return;
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
  team: VrplTeam,
  playerId: string,
  newRole: VrplTeamPlayerRole,
  performedBy: string
) {
  if (!team?.id) return;
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

// export async function removePlayerFromTeam(
//   tournamentId: string,
//   teamId: string,
//   playerId: string,
//   performedBy: string
// ): Promise<VrplTeam | undefined> {
//   const team = await getTeamFromId(tournamentId, teamId);
//   if (!team) return;

//   const filteredTeamPlayers = team.teamPlayers.filter(
//     (teamPlayer) => teamPlayer.playerId !== playerId
//   );
//   const removedTeamPlayer = team.teamPlayers.find(
//     (player) => player.playerId === playerId
//   );
//   if (filteredTeamPlayers.length === team.teamPlayers.length)
//     throw new Error(
//       "Team player doesn't exist, and can therefore not be removed!"
//     );
//   else if (!removedTeamPlayer)
//     throw new Error(
//       "Blah blah error yippie, removePlayerFromTea me rr rrrr rrrrr cou ld nt find player to remove, but does exist? idk anymore"
//     );
//   const teamPlayer: VrplTeamPlayer = {
//     playerId: playerId,
//     role: VrplTeamPlayerRole.None,
//     since: new Date(),
//   };
//   const TeamPlayerUpdate: teamPlayerUpdateRecord = {
//     v: 1,
//     id: uuidv4(),
//     type: recordType.teamPlayerUpdate,
//     tournamentId: team.tournamentId,
//     userId: performedBy,
//     teamId: team.id,
//     playerId: teamPlayer.playerId,
//     timestamp: new Date(),

//     valueChanged: "role",
//     old: removedTeamPlayer.role,
//     new: teamPlayer.role,
//   };

//   team.teamPlayers = filteredTeamPlayers;
//   team.teamPlayers.push(teamPlayer);

//   await Promise.all([
//     VrplTeamDB.updateOne(
//       { id: team.id },
//       { $set: { teamPlayers: team.teamPlayers } }
//     ),
//     storeRecord(TeamPlayerUpdate),
//   ]);
//   return team;
// }

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
      createdAt: new Date(),
      gp: 0,
      losses: 0,
      ties: 0,
      wins: 0,
    };
    // TODO: Handle teams having subteams and they having the same id
    // Also make sure those teams have same createdAt
    if (await getTeamFromId(tournamentId, teamData.id)) {
      return createTeam(tournamentId, teamName, ownerId, performedBy);
    }
    const TeamModel = new VrplTeamDB(teamData);
    const TeamCreateRecord: teamCreateRecord = {
      id: uuidv4(),
      team: teamData,
      tournamentId: teamData.tournamentId,
      teamId: teamData.id,
      timestamp: new Date(),
      type: recordType.teamCreate,
      userId: performedBy,
      v: 1,
    };
    await Promise.all([storeRecord(TeamCreateRecord), TeamModel.save()]);

    return { success: true, doc: teamData };
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
  playerId: string,
  tournamentId?: string
): Promise<VrplTeam[]> {
  return VrplTeamDB.find({
    tournamentId: tournamentId,
    $or: [
      { teamPlayers: { $elemMatch: { playerId: playerId } } },
      { ownerId: playerId },
    ],
  });
}

export async function getAllTeamsFromId(teamId: string): Promise<VrplTeam[]> {
  // @ts-ignore
  return teamCache[teamId] ? Object.values(teamCache[teamId]) : [];
}

// Update team stats after match, stuff like wins and losses and stuff
export async function updateTeamsAfterMatch(
  match: CompletedVrplMatch
): Promise<void> {
  const teamsIds = match.teamIds;
  const gamesPlayed = VrplTeamDB.updateMany(
    {
      id: { $in: teamsIds },
      tournamentId: match.tournamentId,
    },
    {
      $inc: {
        gp: 1,
      },
    }
  );

  let gamesWon;
  if (match.winnerId) {
    gamesWon = VrplTeamDB.updateMany(
      {
        id: match.winnerId,
        tournamentId: match.tournamentId,
      },
      {
        $inc: {
          wins: 1,
        },
      }
    );
  }

  let gamesTied;
  if (match.tiedIds) {
    gamesTied = VrplTeamDB.updateMany(
      {
        id: { $in: match.tiedIds },
        tournamentId: match.tournamentId,
      },
      {
        $inc: {
          wins: 1,
        },
      }
    );
  }

  let gamesLost;
  if (match.loserIds) {
    gamesLost = VrplTeamDB.updateMany(
      {
        id: { $in: match.loserIds },
        tournamentId: match.tournamentId,
      },
      {
        $inc: {
          losses: 1,
        },
      }
    );
  }

  await Promise.all([gamesPlayed, gamesWon, gamesTied, gamesLost]);
}
