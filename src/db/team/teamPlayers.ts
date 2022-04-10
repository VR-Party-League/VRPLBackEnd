import { BadRequestError, InternalServerError } from "../../utils/errors";
import { getPlayersFromIds } from "../player";
import {
  teamPlayerCreateRecord,
  teamPlayerRemoveRecord,
  teamPlayerUpdateRecord,
} from "../models/records/teamRecordTypes";
import { v4 as uuidv4 } from "uuid";
import VrplTeamDB, {
  VrplTeam,
  VrplTeamPlayer,
  VrplTeamPlayerRole,
} from "../models/vrplTeam";
import { storeAndBroadcastRecord, storeAndBroadcastRecords } from "../records";
import { createMessages } from "../messages";
import { VrplPlayer } from "../models/vrplPlayer";
import { MessageButtonActionTypes } from "../models/vrplMessages";
import { recordType } from "../models/records";

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
      { id: team.id, tournamentId: team.tournamentId },
      { $set: { teamPlayers: team.teamPlayers } }
    ),
    storeAndBroadcastRecords(records),
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
    { id: team.id, tournamentId: team.tournamentId },
    { $set: { teamPlayers: team.teamPlayers } }
  );
}

// Change the role of a player on a team.
export async function changeTeamPlayerRole(
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
      { id: team.id, tournamentId: team.tournamentId },
      { $set: { teamPlayers: team.teamPlayers } }
    ),
    storeAndBroadcastRecord(record),
  ]);
  return team;
}

export async function removePlayersFromTeam(
  team: VrplTeam,
  playerIds: string[],
  performedById: string
): Promise<VrplTeam> {
  const removedTeamPlayers: string[] = [];
  for (let playerId of playerIds) {
    const playerIndex = team.teamPlayers.findIndex(
      (player) => player.playerId === playerId
    );
    if (playerIndex !== -1) {
      removedTeamPlayers.push(
        team.teamPlayers.splice(playerIndex, 1)[0].playerId
      );
    }
  }

  const RemoveRecords: teamPlayerRemoveRecord[] = removedTeamPlayers.map(
    (playerId) =>
      ({
        id: uuidv4(),
        userId: performedById,
        type: recordType.teamPlayerRemove,
        tournamentId: team.tournamentId,
        teamId: team.id,
        playerId: playerId,
        v: 1,
        timestamp: new Date(),
      } as teamPlayerRemoveRecord)
  );
  const [remRes] = await Promise.all([
    VrplTeamDB.updateOne(
      {
        tournamentId: team.tournamentId,
        id: team.id,
      },
      { teamPlayers: team.teamPlayers }
    ).exec(),
    storeAndBroadcastRecords(RemoveRecords),
  ]);
  if (remRes.modifiedCount === 0)
    throw new InternalServerError("No team modified");
  return team;
}
