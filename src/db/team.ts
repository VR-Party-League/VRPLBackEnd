import VrplTeamDB, {
  SocialPlatform,
  VrplTeam,
  VrplTeamPlayer,
  VrplTeamPlayerRole,
} from "../db/models/vrplTeam";
import * as Sentry from "@sentry/node";
import {v4 as uuidv4} from "uuid";
import {storeRecord, storeRecords} from "./logs";
import {
  teamCreateRecord,
  teamDeleteRecord,
  teamPlayerCreateRecord,
  teamPlayerRemoveRecord,
  teamPlayerUpdateRecord,
  teamUpdateRecord,
} from "./models/records/teamRecordTypes";
import { recordType } from "./models/records";
import { CompletedVrplMatch } from "./models/vrplMatch";
import { VrplTournament } from "./models/vrplTournaments";
import { BadRequestError, InternalServerError } from "../utils/errors";
import { createMessages } from "./messages";
import { MessageButtonActionTypes } from "./models/vrplMessages";
import { VrplPlayer } from "./models/vrplPlayer";
import { getPlayersFromIds } from "./player";
import _ from "lodash";
import {
  discordInviteRegex,
  twitchRegex,
  twitterRegex,
  youtubeChannelRegex,
} from "../utils/regex/team";
import { AnyBulkWriteOperation } from "mongodb";
import { SeededVrplTeam } from "./models/vrplTeam";

// TODO: add Sentry.captureException(err) to more places!

// TODO: Test this really does return an array, and not a cursor or whatever
export async function getTeamsOfTournament(tournamentId: string) {
  return VrplTeamDB.find({ tournamentId: tournamentId }).exec();
}

export async function getTeamFromId(tournamentId: string, teamId: string) {
  return VrplTeamDB.findOne({
    tournamentId: tournamentId,
    id: teamId,
  });
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

export async function deleteTeam(
  tournamentId: string,
  teamId: string,
  performedById: string
) {
  try {
    const deleted = await VrplTeamDB.findOneAndDelete({
      id: teamId,
      tournamentId: tournamentId,
    }).exec();
    // TODO: Remove avatars!!!!
    if (!deleted?.ownerId) throw new InternalServerError("Did not delete team");
    await storeRecord({
      v: 1,
      id: uuidv4(),
      userId: performedById,
      type: recordType.teamDelete,
      tournamentId: tournamentId,
      teamId: teamId,
      team: deleted.toObject(),
      timestamp: new Date(),
    } as teamDeleteRecord);
    return deleted.toObject();
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
    { id: team.id, tournamentId: team.tournamentId },
    { $set: { teamPlayers: team.teamPlayers } }
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
      { id: team.id, tournamentId: team.tournamentId },
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
      { id: team.id, tournamentId: team.tournamentId },
      { $set: { teamPlayers: team.teamPlayers } }
    ),
    storeRecord(record),
  ]);
  return team;
}

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
      socials: {},
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
      { teamPlayers: { $elemMatch: { playerId: playerId } } },
      { ownerId: playerId },
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
export async function updateTeamsAfterMatch(match: CompletedVrplMatch): Promise<void> {
  const teamSeeds = match.teamSeeds;
  const gamesPlayed = VrplTeamDB.updateMany(
    {
      tournamentId: match.tournamentId,
      seed: { $in: teamSeeds },
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
    .updateOne({ name: validatedTeamName })
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
    storeRecords(RemoveRecords),
  ]);
  if (remRes.modifiedCount === 0)
    throw new InternalServerError("No team modified");
  return team;
}

export async function addSocialAccountToTeam(
  team: VrplTeam,
  platform: SocialPlatform,
  code: string,
  performedById: string
) {
  const toSet: { [key: string]: string } = {};
  switch (platform) {
    case "twitch":
      if (!twitchRegex.test(code))
        throw new BadRequestError("Invalid twitch channel name");
      break;
    case "youtube":
      if (!youtubeChannelRegex.test(code))
        throw new BadRequestError("Invalid youtube channel ID");
      break;
    case "twitter":
      if (!twitterRegex.test(code))
        throw new BadRequestError("Invalid twitter handle");
      break;
    // case "instagram":
    //   if (!instagramRegex.test(code))
    //     throw new BadRequestError("Invalid instagram handle");
    //   break;
    // case "facebook":
    //   if (!facebookRegex.test(code))
    //     throw new BadRequestError("Invalid facebook handle");
    //   break;
    case "discord":
      if (!discordInviteRegex.test(code))
        throw new BadRequestError("Invalid discord invite code");
      break;
    // case website:
    //   team.website = code;
    //   break;
    default:
      throw new BadRequestError("Invalid social platform");
  }

  const oldSocials = Object.assign({}, team.socials);
  team.socials[platform] = code;
  const UpdateRecord: teamUpdateRecord = {
    id: uuidv4(),
    tournamentId: team.tournamentId,
    teamId: team.id,
    timestamp: new Date(),
    type: recordType.teamUpdate,
    userId: performedById,
    valueChanged: `socials`,
    new: team.socials,
    old: oldSocials,
    v: 1,
  };
  const UpdatePromise = VrplTeamDB.findOne()
    .updateOne(
      {
        tournamentId: team.tournamentId,
        id: team.id,
      },
      { $set: { [`socials.${platform}`]: code } }
    )
    .exec();
  const [updateRes] = await Promise.all([
    UpdatePromise,
    storeRecord(UpdateRecord),
  ]);
  if (updateRes.matchedCount === 0)
    throw new InternalServerError("No team matched when updating socials");
  else if (updateRes.modifiedCount === 0)
    throw new InternalServerError("No team modified when updating socials");
  return team;
}

export async function removeSocialAccountFromTeam(
  team: VrplTeam,
  platform: SocialPlatform,
  performedById: string
): Promise<VrplTeam> {
  const oldSocials = Object.assign({}, team.socials);
  delete team.socials[platform];
  const UpdateRecord: teamUpdateRecord = {
    id: uuidv4(),
    tournamentId: team.tournamentId,
    teamId: team.id,
    timestamp: new Date(),
    type: recordType.teamUpdate,
    userId: performedById,
    valueChanged: `socials`,
    new: team.socials,
    old: oldSocials,
    v: 1,
  };
  const UpdatePromise = VrplTeamDB.findOne()
    .updateOne(
      {
        tournamentId: team.tournamentId,
        id: team.id,
      },
      { $unset: { [`socials.${platform}`]: "" } }
    )
    .exec();
  const [updateRes] = await Promise.all([
    UpdatePromise,
    storeRecord(UpdateRecord),
  ]);
  if (updateRes.matchedCount === 0)
    throw new InternalServerError("No team matched when removing socials");
  else if (updateRes.modifiedCount === 0)
    throw new InternalServerError("No team modified when removing socials");
  return team;
}

export async function seedAllTeams(
  tournament: VrplTournament,
  performedById: string
  // random?: boolean
  // clearPrevious?: boolean
): Promise<SeededVrplTeam[]> {
  const teams = await getTeamsOfTournament(tournament.id);
  const notSeededTeams = teams.filter((team) => team.seed === undefined);
  const seededTeams = teams.filter((team) => team.seed !== undefined);
  if (notSeededTeams.length === 0) return teams as SeededVrplTeam[];
  const notSeededTeamsAmount = notSeededTeams.length;
  const seedsUsed = seededTeams.map((team) => team.seed) as number[];
  let seed = 0;

  const bulkWrites: AnyBulkWriteOperation<VrplTeam>[] = [];
  const records: teamUpdateRecord[] = [];

  while (true) {
    if (seedsUsed.includes(seed)) {
      seed++;
      continue;
    }
    const team = notSeededTeams.shift();
    seedsUsed.push(seed);
    if (!team) break;
    team.seed = seed;
    bulkWrites.push({
      updateOne: {
        filter: {
          id: team.id,
          tournamentId: team.tournamentId,
        },
        update: {
          $set: {
            seed: seed,
          },
        },
      },
    });
    records.push({
      id: uuidv4(),
      tournamentId: team.tournamentId,
      teamId: team.id,
      timestamp: new Date(),
      type: recordType.teamUpdate,
      userId: performedById,
      valueChanged: `seed`,
      new: seed,
      old: undefined,
      v: 1,
    });
  }

  const [res] = await Promise.all([
    VrplTeamDB.bulkWrite(bulkWrites),
    storeRecords(records),
  ]);
  if (res.modifiedCount !== notSeededTeamsAmount)
    throw new InternalServerError(
      `Failed to seed teams, seeded ${res.modifiedCount} teams out of ${notSeededTeamsAmount} (${res.matchedCount} teams matched)`
    );
  return teams as SeededVrplTeam[];
}

export async function unSeedAllTeams(
  tournament: VrplTournament,
  performedById: string
) {
  const teams = await getTeamsOfTournament(tournament.id);
  const seededTeams = teams.filter((team) => team.seed !== undefined);
  const bulkWrites: AnyBulkWriteOperation<VrplTeam>[] = [];
  const records: teamUpdateRecord[] = [];
  seededTeams.forEach((team) => {
    records.push({
      id: uuidv4(),
      tournamentId: team.tournamentId,
      teamId: team.id,
      timestamp: new Date(),
      type: recordType.teamUpdate,
      userId: performedById,
      valueChanged: `seed`,
      new: undefined,
      old: team.seed,
      v: 1,
    });
    team.seed = undefined;
    bulkWrites.push({
      updateOne: {
        filter: {
          id: team.id,
          tournamentId: team.tournamentId,
        },
        update: {
          $unset: {
            seed: "",
          },
        },
      },
    });
  });

  const [res] = await Promise.all([
    VrplTeamDB.bulkWrite(bulkWrites),
    storeRecords(records),
  ]);
  if (res.modifiedCount !== seededTeams.length)
    throw new InternalServerError(
      `Failed to unseed all teams, unseeded ${res.modifiedCount} teams out of ${seededTeams.length} (${res.matchedCount} teams matched)`
    );
  return teams as VrplTeam[];
}

export async function setTeamSeed(
  team: VrplTeam,
  seed: number,
  performedById: string
) {
  const [res] = await Promise.all([
    VrplTeamDB.updateOne(
      {
        id: team.id,
        tournamentId: team.tournamentId,
      },
      {
        $set: {
          seed: seed,
        },
      }
    ),
    storeRecord({
      id: uuidv4(),
      tournamentId: team.tournamentId,
      teamId: team.id,
      timestamp: new Date(),
      type: recordType.teamUpdate,
      userId: performedById,
      valueChanged: `seed`,
      new: seed,
      old: team.seed,
      v: 1,
    }),
  ]);
  if (res.modifiedCount !== 1)
    throw new InternalServerError(
      `Failed to set seed of team ${team.id} ${team.tournamentId}, (${res.matchedCount} teams matched, ${res.modifiedCount} modified)`
    );
  team.seed = seed;
  return team;
}

export async function clearTeamSeed(team: VrplTeam, performedById: string) {
  const [res] = await Promise.all([
    VrplTeamDB.updateOne(
      {
        id: team.id,
        tournamentId: team.tournamentId,
      },
      {
        $unset: {
          seed: "",
        },
      }
    ),
    storeRecord({
      id: uuidv4(),
      tournamentId: team.tournamentId,
      teamId: team.id,
      timestamp: new Date(),
      type: recordType.teamUpdate,
      userId: performedById,
      valueChanged: `seed`,
      new: undefined,
      old: team.seed,
      v: 1,
    }),
  ]);
  if (res.modifiedCount !== 1)
    throw new InternalServerError(
      `Failed to clear seed of team ${team.id} ${team.tournamentId}, (${res.matchedCount} teams matched, ${res.modifiedCount} modified)`
    );

  team.seed = undefined;
  return team;
}
