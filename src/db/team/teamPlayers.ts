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
import { MessageButtonActionTypes } from "../models/vrplMessages";
import { recordType } from "../models/records";
import { VrplAuth } from "../../index";

export async function invitePlayersToTeam(
  team: VrplTeam,
  playerIds: string[],
  newPlayerRole: VrplTeamPlayerRole,
  auth: VrplAuth
): Promise<VrplTeam | undefined> {
  if (!auth.playerId) throw new InternalServerError("No player linked to user");
  if (!team?.id) throw new BadRequestError("No team provided");
  else if (!playerIds) throw new BadRequestError("No player provided");
  else if (!newPlayerRole) throw new BadRequestError("No role provided");
  else if (newPlayerRole == VrplTeamPlayerRole.Pending)
    throw new BadRequestError("Pending is not a valid role");
  const inviter = await auth.getPlayer();
  if (!inviter)
    throw new BadRequestError("This request can only be sent by a player");
  // const teamPlayers: VrplTeamPlayer[] = playerIds.map((playerId) => ({
  //   playerId: playerId,
  //   role: VrplTeamPlayerRole.Pending,
  //   since: new Date(),
  // }));
  // const newPlayerIds = [...playerIds, auth.playerId];
  // const players = await getPlayersFromIds(newPlayerIds);
  // const inviterIndex = players.findIndex(
  //   (player) => player.id == auth.playerId
  // );
  // if (inviterIndex === -1)
  //   throw new InternalServerError("Player not fetched from db");
  // const inviter = players[inviterIndex];
  // console.log("inviter", inviter);
  // if (!playerIds.includes(inviter.id)) players.splice(inviterIndex, 1);
  // console.log("players", players);
  // if (!players) throw new InternalServerError("Could not get players");
  // else if (players.length + 1 != playerIds)
  //   throw new InternalServerError("Could not get all players");
  const enteredPlayers = await getPlayersFromIds(playerIds);
  if (enteredPlayers.length !== playerIds.length)
    throw new InternalServerError("Could not get all entered players");

  const records: teamPlayerCreateRecord[] = [];
  for (const player of enteredPlayers) {
    const oldTeamPlayer = team.teamPlayers.find(
      (tp) => tp.playerId == player.id
    );
    if (oldTeamPlayer) {
      if (oldTeamPlayer.role == VrplTeamPlayerRole.Pending)
        throw new BadRequestError(
          `Player ${player.nickname} is already invited to this team`
        );
      else
        throw new BadRequestError(
          `Player ${player.nickname} is already a member of this team`
        );
    }
    team.teamPlayers.push({
      playerId: player.id,
      role: VrplTeamPlayerRole.Pending,
      since: new Date(),
    });
    const record: teamPlayerCreateRecord = {
      v: 1,
      id: uuidv4(),
      type: recordType.teamPlayerCreate,
      tournamentId: team.tournamentId,
      performedByPlayerId: auth.playerId,
      performedByUserId: auth.userId,
      teamId: team.id,
      playerId: player.id,
      timestamp: new Date(),
      role: VrplTeamPlayerRole.Pending,
      team: team,
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
        senderId: inviter.id,
        content: `${inviter.nickname} invited you to join their team '${team.name}'!`,
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
  role: VrplTeamPlayerRole,
  auth: VrplAuth
) {
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

  team.teamPlayers.push(teamPlayer);
  const record: teamPlayerCreateRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.teamPlayerCreate,
    tournamentId: team.tournamentId,
    teamId: team.id,
    performedByPlayerId: auth.playerId,
    performedByUserId: auth.userId,
    playerId: teamPlayer.playerId,
    timestamp: new Date(),
    role: teamPlayer.role,
    team: team,
  };

  await Promise.all([
    VrplTeamDB.updateOne(
      { id: team.id, tournamentId: team.tournamentId },
      { $set: { teamPlayers: team.teamPlayers } }
    ),
    storeAndBroadcastRecord(record),
  ]);
}

// Change the role of a player on a team.
export async function changeTeamPlayerRole(
  team: VrplTeam,
  playerId: string,
  newRole: VrplTeamPlayerRole,
  auth: VrplAuth
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
      performedByPlayerId: auth.playerId,
      performedByUserId: auth.userId,
      teamId: team.id,
      playerId: teamPlayer.playerId,
      timestamp: new Date(),

      valueChanged: "role",
      old: oldPlayer.role,
      new: teamPlayer.role,
      team: team,
    };
  } else {
    record = {
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
  auth: VrplAuth
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
    (playerId) => ({
      id: uuidv4(),
      performedByPlayerId: auth.playerId,
      performedByUserId: auth.userId,
      type: recordType.teamPlayerRemove,
      tournamentId: team.tournamentId,
      teamId: team.id,
      playerId: playerId,
      v: 1,
      team: team,
      timestamp: new Date(),
    })
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
