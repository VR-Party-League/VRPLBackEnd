import VrplTeamDB, {
  SeededVrplTeam,
  SocialPlatform,
  VrplTeam,
  VrplTeamPlayer,
  VrplTeamPlayerRole,
} from "../models/vrplTeam";
import * as Sentry from "@sentry/node";
import { v4 as uuidv4 } from "uuid";
import { storeAndBroadcastRecord, storeAndBroadcastRecords } from "../records";
import {
  teamCreateRecord,
  teamDeleteRecord,
  teamPlayerCreateRecord,
  teamPlayerUpdateRecord,
  teamUpdateRecord,
} from "../models/records/teamRecordTypes";
import { recordType } from "../models/records";
import { CompletedVrplMatch } from "../models/vrplMatch";
import { VrplTournament } from "../models/vrplTournaments";
import { BadRequestError, InternalServerError } from "../../utils/errors";
import _ from "lodash";

import * as fetch from "./fetch";
import { deleteTeamAvatar } from "../../utils/storage";
import { VrplAuth } from "../../index";

export * from "./fetch";
export * from "./teamPlayers";
export * from "./seeds";
export * from "./socials";

export async function deleteTeam(
  tournament: VrplTournament,
  team: VrplTeam,
  auth: VrplAuth
) {
  try {
    const deleted = await VrplTeamDB.findOneAndDelete({
      id: team.id,
      tournamentId: tournament.id,
    }).exec();
    if (team.avatarHash) team = await deleteTeamAvatar(team, auth, true);
    if (!deleted?.ownerId) throw new InternalServerError("Did not delete team");
    await storeAndBroadcastRecord({
      v: 1,
      id: uuidv4(),
      performedByPlayerId: auth.playerId,
      performedByUserId: auth.userId,
      type: recordType.teamDelete,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      teamId: team.id,
      team: team,
      timestamp: new Date(),
    } as teamDeleteRecord);
    return team;
  } catch (err) {
    console.trace();
    console.error(err);
    Sentry.captureException(err);
  }
}

// This function makes a new player the owner of a team.
export async function transferTeam(
  team: VrplTeam,
  playerId: string,
  auth: VrplAuth,
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
        performedByPlayerId: auth.playerId,
        performedByUserId: auth.userId,
        tournamentId: team.tournamentId,

        teamId: team.id,
        playerId: teamPlayer.playerId,
        timestamp: new Date(),

        valueChanged: "role",
        old: oldPlayer.role,
        new: teamPlayer.role,

        team: team,
      };
    } else {
      changePlayersRecordPromise = {
        v: 1,
        id: uuidv4(),
        type: recordType.teamPlayerCreate,
        tournamentId: team.tournamentId,

        performedByPlayerId: auth.playerId,
        performedByUserId: auth.userId,
        teamId: team.id,
        playerId: teamPlayer.playerId,
        timestamp: new Date(),

        role: teamPlayer.role,
        team: team,
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
    performedByPlayerId: auth.playerId,
    performedByUserId: auth.userId,
    teamId: team.id,
    timestamp: new Date(),
    valueChanged: "ownerId",
    new: playerId,
    old: `${team.ownerId}`,
    team: team,
  };
  team.ownerId = playerId;

  await Promise.all([
    VrplTeamDB.updateOne(
      { id: team.id, tournamentId: team.tournamentId },
      { $set: { ownerId: team.ownerId, teamPlayers: team.teamPlayers } }
    ),
    storeAndBroadcastRecord(TeamUpdateRecord),
    changePlayersRecordPromise
      ? storeAndBroadcastRecord(changePlayersRecordPromise)
      : null,
  ]);
  return team;
}

export async function createTeam(
  tournamentId: string,
  teamName: string,
  ownerId: string,
  auth: VrplAuth
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
      socials: {},
      gp: 0,
      losses: 0,
      ties: 0,
      wins: 0,
    };
    // TODO: Handle teams having subteams and they having the same id
    // Also make sure those teams have same createdAt
    if (await fetch.getTeamFromId(tournamentId, teamData.id))
      throw new InternalServerError("Team with same id already exists!");

    const TeamModel = new VrplTeamDB(teamData);
    const TeamCreateRecord: teamCreateRecord = {
      id: uuidv4(),
      team: teamData,
      tournamentId: tournamentId,
      teamId: teamData.id,
      timestamp: new Date(),
      type: recordType.teamCreate,
      performedByPlayerId: auth.playerId,
      performedByUserId: auth.userId,
      v: 1,
    };
    await Promise.all([
      storeAndBroadcastRecord(TeamCreateRecord),
      TeamModel.save(),
    ]);

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
  else if (TeamName.length < 4)
    throw new invalidTeamNameError(
      "TeamName must at least be 4 characters long: " + TeamName
    );
  else if (TeamName.length > 25)
    throw new invalidTeamNameError(
      "TeamName cannot be longer then 25 characters: " + TeamName
    );
  // The name can actually be "longer then 25 characters" because the string "longer then 25 characters" is exactly 25 characters long! :D

  // Check for other teams
  const existingTeamName = await fetch.getTeamFromName(tournamentId, TeamName);

  if (existingTeamName)
    throw new invalidTeamNameError("Team name has been taken: " + TeamName);

  return TeamName;
}

// Update team stats after match, stuff like wins and losses and stuff
// TODO: Add records here
export async function updateTeamsAfterMatch(
  match: CompletedVrplMatch,
  teams: SeededVrplTeam[]
): Promise<void> {
  const teamIds = teams.map((team) => team.id);
  const gamesPlayed = VrplTeamDB.updateMany(
    {
      id: { $in: teamIds },
      tournamentId: match.tournamentId,
    },
    {
      $inc: {
        gp: 1,
      },
    }
  );

  let gamesWon = undefined;
  if (match.winnerId) {
    gamesWon = VrplTeamDB.updateOne(
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

  let gamesTied = undefined;
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

  let gamesLost: any = undefined;
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

export const updateTeamName = async (
  team: VrplTeam,
  newTeamName: string,
  auth: VrplAuth
): Promise<VrplTeam> => {
  const validatedTeamName = await validateTeamName(
    team.tournamentId,
    newTeamName
  );
  const teamData: VrplTeam = { ...team, name: validatedTeamName };
  const UpdatePromise = VrplTeamDB.updateOne(
    {
      tournamentId: team.tournamentId,
      id: team.id,
    },
    { name: validatedTeamName }
  ).exec();
  const TeamUpdateRecord: teamUpdateRecord = {
    id: uuidv4(),
    tournamentId: teamData.tournamentId,
    teamId: teamData.id,
    timestamp: new Date(),
    type: recordType.teamUpdate,
    performedByPlayerId: auth.playerId,
    performedByUserId: auth.userId,
    valueChanged: "name",
    new: validatedTeamName,
    old: team.name,
    team: teamData,
    v: 1,
  };
  const [rec, res] = await Promise.all([
    storeAndBroadcastRecord(TeamUpdateRecord),
    UpdatePromise,
  ]);
  if (res.modifiedCount === 0)
    throw new InternalServerError("No team modified");
  return teamData;
};

export async function setTeamAvatarHash(
  team: VrplTeam,
  avatarHash: string | null,
  auth: VrplAuth
) {
  if (team.avatarHash === avatarHash) return team;
  team.avatarHash = avatarHash ?? undefined;
  const [res] = await Promise.all([
    VrplTeamDB.updateOne(
      {
        id: team.id,
        tournamentId: team.tournamentId,
      },
      {
        $set: {
          avatarHash: avatarHash,
        },
      }
    ),
    storeAndBroadcastRecord({
      id: uuidv4(),
      tournamentId: team.tournamentId,
      teamId: team.id,
      timestamp: new Date(),
      type: recordType.teamUpdate,
      performedByPlayerId: auth.playerId,
      performedByUserId: auth.userId,
      valueChanged: `avatarHash`,
      new: avatarHash,
      old: team.avatarHash,
      team: team,
      v: 1,
    }),
  ]);
  if (res.modifiedCount !== 1)
    throw new InternalServerError(
      `Failed to set avatar hash of team ${team.id} ${team.tournamentId}, (${res.matchedCount} teams matched, ${res.modifiedCount} modified)`
    );
  return team;
}
