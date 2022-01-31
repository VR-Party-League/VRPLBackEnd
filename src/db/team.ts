import VrplTeamDB, {
  VrplTeam,
  VrplTeamPlayer,
  VrplTeamPlayerRole,
} from "../db/models/vrplTeam";
import * as Sentry from "@sentry/node";
import {v4 as uuidv4} from "uuid";
import {storeRecord, storeRecords} from "./logs";
import {
  teamCreateRecord,
  teamPlayerCreateRecord, teamPlayerRemoveRecord,
  teamPlayerUpdateRecord,
  teamUpdateRecord,
} from "./models/records/teamRecordTypes";
import {recordType} from "./models/records";
import {CompletedVrplMatch} from "./models/vrplMatch";
import {VrplTournament} from "./models/vrplTournaments";
import {BadRequestError, InternalServerError} from "../utils/errors";
import {createMessages} from "./messages";
import Player from "../schemas/Player";
import {MessageButtonActionTypes} from "./models/vrplMessages";
import {VrplPlayer} from "./models/vrplPlayer";
import {getAllPlayerIds, getPlayersFromIds} from "./player";
import _ from "lodash";

// TODO: add Sentry.captureException(err) to more places!

// TODO: Test this really does return an array, and not a cursor or whatever
export async function getTeamsOfTournament(
  tournamentId: string
): Promise<VrplTeam[]> {
  return VrplTeamDB.find({tournamentId: tournamentId});
}

export async function getTeamFromId(tournamentId: string, teamId: string) {
  return VrplTeamDB.findOne({
    tournamentId: tournamentId,
    id: teamId,
  })
}

export async function getTeamsFromIds(tournamentId: string, teamIds: string[]) {
  return (
    (await VrplTeamDB.find({
      tournamentId: tournamentId,
      id: {$in: teamIds},
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
export async function getTeamFromName(tournamentId: string, TeamName: string) {
  return await VrplTeamDB.findOne({
    tournamentId: tournamentId,
    name: {$regex: new RegExp(`${_.escapeRegExp(TeamName)}`, "gi")},
  }).maxTimeMS(1000);
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
    teamPlayers: {$elemMatch: {playerId: playerId, role: role}},
  });
}

export async function invitePlayersToTeam(
  team: VrplTeam,
  playerIds: string[],
  newPlayerRole: VrplTeamPlayerRole,
  performedBy: VrplPlayer
): Promise<VrplTeam | undefined> {
  if (!team?.id) throw new BadRequestError("No team provided");
  else if (!playerIds) throw new BadRequestError("No player provided");
  else if (!newPlayerRole) throw new BadRequestError("No role provided");
  else if (newPlayerRole == VrplTeamPlayerRole.Pending)
    throw new BadRequestError("Pending is not a valid role");
  console.log("newPlayerRole", newPlayerRole);
  const teamPlayers: VrplTeamPlayer[] = playerIds.map((playerId) => ({
    playerId: playerId,
    role: VrplTeamPlayerRole.Pending,
    since: new Date(),
  }));
  const players = await getPlayersFromIds(playerIds);
  if (!players) throw new InternalServerError("Could not get players");
  else if (players.length != playerIds.length)
    throw new InternalServerError("Could not get all players");
  const records: teamPlayerCreateRecord[] = [];
  for (const teamPlayer of teamPlayers) {
    const player = players.find((p) => p.id == teamPlayer.playerId);
    const oldTeamPlayer = team.teamPlayers.find(
      (tp) => tp.playerId == teamPlayer.playerId
    );
    if (!player)
      throw new InternalServerError(
        `Could not get player ${teamPlayer.playerId}`
      );
    else if (oldTeamPlayer) {
      if (oldTeamPlayer.role == VrplTeamPlayerRole.Pending)
        throw new BadRequestError(
          `Player ${player.nickname} already invited to this team`
        );
      else
        throw new BadRequestError(
          `Player ${player.nickname} already a member of this team`
        );
    }
    team.teamPlayers.push(teamPlayer);
    const record: teamPlayerCreateRecord = {
      v: 1,
      id: uuidv4(),
      type: recordType.teamPlayerCreate,
      tournamentId: team.tournamentId,
      userId: performedBy.id,
      teamId: team.id,
      playerId: teamPlayer.playerId,
      timestamp: new Date(),
      role: teamPlayer.role,
    };
    records.push(record);
  }
  
  await Promise.all([
    VrplTeamDB.updateOne(
      {id: team.id, tournamentId: team.tournamentId},
      {$set: {teamPlayers: team.teamPlayers}}
    ),
    storeRecords(records),
    createMessages(
      {
        title: `You have been invited to join '${team.name}'`,
        senderId: performedBy.id,
        content: `${performedBy.nickname} invited you to join their team '${team.name}'!`,
        isPickOne: true,
        buttons: [
          {
            text: "Accept",
            colorHex: "#00FF7F",
            action: {
              type: MessageButtonActionTypes.AcceptTeamInvite,
              tournamentId: team.tournamentId,
              teamId: team.id,
              role: newPlayerRole,
            },
          },
          {
            text: "Decline",
            colorHex: "#FF4040",
            action: {
              type: MessageButtonActionTypes.DeclineTeamInvite,
              tournamentId: team.tournamentId,
              teamId: team.id,
            },
          },
        ],
      },
      playerIds
    ),
  ]);
  return team;
}

export async function addPlayerToTeam(
  team: VrplTeam,
  playerId: string,
  role: VrplTeamPlayerRole
) {
  console.log;
  if (role === VrplTeamPlayerRole.Pending)
    throw new BadRequestError("Pending is not a valid role");
  
  const teamPlayer: VrplTeamPlayer = {
    playerId: playerId,
    role: role,
    since: new Date(),
  };
  const oldTeamPlayer = team.teamPlayers.find(
    (tp) =>
      tp.playerId == teamPlayer.playerId &&
      tp.role == VrplTeamPlayerRole.Pending
  );
  if (oldTeamPlayer)
    if (oldTeamPlayer.role !== VrplTeamPlayerRole.Pending)
      throw new InternalServerError(
        `Player ${playerId} already in team ${team.id} tournament ${team.tournamentId}`
      );
    else {
      team.teamPlayers = team.teamPlayers.filter(
        (tp) => tp.playerId !== teamPlayer.playerId
      );
    }
  
  console.log("newTeamplayer", teamPlayer);
  team.teamPlayers.push(teamPlayer);
  console.log("setting stuff rn", team.teamPlayers);
  await VrplTeamDB.updateOne(
    {id: team.id, tournamentId: team.tournamentId},
    {$set: {teamPlayers: team.teamPlayers}}
  );
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
      {id: team.id, tournamentId: team.tournamentId},
      {$set: {ownerId: team.ownerId, teamPlayers: team.teamPlayers}}
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
      {id: team.id, tournamentId: team.tournamentId},
      {$set: {teamPlayers: team.teamPlayers}}
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
): Promise<VrplTeam> {
  try {
    const validatedTeamName = await validateTeamName(tournamentId, teamName);
    
    const teamData: VrplTeam = {
      ownerId: ownerId,
      id: uuidv4(),
      name: validatedTeamName,
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
    
    return teamData;
  } catch (err) {
    if (err instanceof invalidTeamNameError) throw err;
    console.trace();
    console.error(err);
    Sentry.captureException(err);
    throw err;
  }
}

class invalidTeamNameError extends BadRequestError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Validates a team name and throws errors if its invalid
 * It returns the valid team name
 * The team name cant be smaller then 5 chars, and not longer then 25 chars
 * @param tournamentId string
 * @param name string
 * @returns string
 */
export async function validateTeamName(
  tournamentId: string,
  name: any
): Promise<string> {
  if (typeof name !== "string")
    throw new invalidTeamNameError("TeamName is not a string");
  
  let TeamName = name
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/, "")
    .replace(/-+/, "-")
    .replace(/_+/, "_")
    .trim();
  if (!/^[\w-_\s]+$/.test(TeamName))
    throw new invalidTeamNameError("Invalid name: " + TeamName);
  else if (TeamName.length < 5)
    throw new invalidTeamNameError(
      "TeamName must at least be 5 characters long: " + TeamName
    );
  else if (TeamName.length > 25)
    throw new invalidTeamNameError(
      "TeamName cannot be longer then 25 characters: " + TeamName
    );
  // The name can actually be "longer then 25 characters" because the string "longer then 25 characters" is exactly 25 characters long! :D
  
  // Check for other teams
  const existingTeamName = await getTeamFromName(tournamentId, TeamName);
  
  if (existingTeamName)
    throw new invalidTeamNameError("Team name has been taken: " + TeamName);
  
  return TeamName;
}

// A function that returns all the teams of a player.
export async function getAllTeamsOfPlayer(
  playerId: string,
  tournamentId?: string
): Promise<VrplTeam[]> {
  let query: any = {
    $or: [
      {teamPlayers: {$elemMatch: {playerId: playerId}}},
      {ownerId: playerId},
    ],
  };
  if (tournamentId) query["tournamentId"] = tournamentId;
  let res = await VrplTeamDB.find(query);
  return res;
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
      id: {$in: teamsIds},
      tournamentId: match.tournamentId,
    },
    {
      $inc: {
        gp: 1,
      },
    }
  );
  
  let gamesWon: any = undefined;
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
  
  let gamesTied: any = undefined;
  if (match.tiedIds) {
    gamesTied = VrplTeamDB.updateMany(
      {
        id: {$in: match.tiedIds},
        tournamentId: match.tournamentId,
      },
      {
        $inc: {
          wins: 1,
        },
      }
    );
  }
  
  let gamesLost: any = undefined;
  if (match.loserIds) {
    gamesLost = VrplTeamDB.updateMany(
      {
        id: {$in: match.loserIds},
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

export const updateTeamName = async (
  team: VrplTeam,
  tournament: VrplTournament,
  newTeamName: string,
  performedBy: string
): Promise<VrplTeam> => {
  const validatedTeamName = await validateTeamName(tournament.id, newTeamName);
  
  const teamData: VrplTeam = Object.assign({}, team);
  teamData.name = validatedTeamName;
  const UpdatePromise = VrplTeamDB.findOne({
    tournamentId: tournament.id,
    id: team.id,
  })
    .updateOne({name: validatedTeamName})
    .exec();
  const TeamUpdateRecord: teamUpdateRecord = {
    id: uuidv4(),
    tournamentId: teamData.tournamentId,
    teamId: teamData.id,
    timestamp: new Date(),
    type: recordType.teamUpdate,
    userId: performedBy,
    valueChanged: "name",
    new: validateTeamName,
    old: team.name,
    v: 1,
  };
  const [rec, res] = await Promise.all([
    storeRecord(TeamUpdateRecord),
    UpdatePromise,
  ]);
  if (res.modifiedCount === 0)
    throw new InternalServerError("No team modified");
  return teamData;
};


export async function removePlayersFromTeam(team: VrplTeam, playerIds: string[], performedById: string): Promise<VrplTeam> {
  const removedTeamPlayers: string[] = []
  for (let playerId of playerIds) {
    const playerIndex = team.teamPlayers.findIndex(player => player.playerId === playerId);
    if (playerIndex !== -1) {
      removedTeamPlayers.push(team.teamPlayers.splice(playerIndex, 1)[0].playerId);
    }
  }
  
  const RemoveRecords: teamPlayerRemoveRecord[] = removedTeamPlayers.map(playerId => ({
      id: uuidv4(),
      userId: performedById,
      type: recordType.teamPlayerRemove,
      
      tournamentId: team.tournamentId,
      teamId: team.id,
      playerId: playerId,
      
      v: 1,
      timestamp: new Date(),
    }) as teamPlayerRemoveRecord
  );
  const [remRes] = await Promise.all([
    VrplTeamDB.updateOne({
      tournamentId: team.tournamentId,
      id: team.id,
    }, {teamPlayers: team.teamPlayers}).exec(),
    storeRecords(RemoveRecords),
  ])
  if (remRes.modifiedCount === 0)
    throw new InternalServerError("No team modified");
  return team;
  
}
