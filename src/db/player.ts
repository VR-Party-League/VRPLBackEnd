import VrplPlayerDB, { VrplPlayer, VrplRegion } from "../db/models/vrplPlayer";
import {
  playerCreateRecord,
  playerUpdateRecord,
} from "./models/records/playerRecords";
import { v4 as uuidv4 } from "uuid";
import { recordType } from "./models/records";
import { storeAndBroadcastRecord, storeAndBroadcastRecords } from "./records";

import { APIUser } from "discord-api-types/v9";
import { cleanNameFromInput, isValidEmailRegex } from "../utils/regex/player";
import { PlayerNicknameHistoryItem } from "../schemas/Player";
import { BadRequestError, InternalServerError } from "../utils/errors";
import discord from "../utils/discord";
import { createUser } from "./user";
import { VrplAuth } from "../index";
import { VrplUser } from "./models/vrplUser";
import { ObjectId } from "mongoose";

export async function getPlayerFromId(PlayerId: string) {
  return await VrplPlayerDB.findOne({ id: PlayerId }).exec();
}

export async function getPlayersFromIds(playerIds: string[]) {
  return await VrplPlayerDB.find({ id: { $in: playerIds } }).exec();
}

export async function getAllPlayerIds() {
  const data = await VrplPlayerDB.find({}, { id: 1 });
  return data.map((player) => player.id);
}

export async function getPlayerFromNickname(nickname: string, notId?: string) {
  return await VrplPlayerDB.findOne({
    $text: {
      $search: nickname,
      $caseSensitive: false,
      $diacriticSensitive: false,
    },
    id: notId
      ? {
          $ne: notId,
        }
      : undefined,
  }).exec();
}

export async function getPlayerFromUserId(userId: ObjectId) {
  return await VrplPlayerDB.findOne({ userId }).exec();
}

export async function getPlayerFromDiscordTag(discordTag: string) {
  return await VrplPlayerDB.findOne({ discordTag: discordTag }).exec();
}

export async function getPlayerFromDiscordId(discordId: string) {
  return await VrplPlayerDB.findOne({ discordId: discordId }).exec();
}

export async function updatePlayerDiscordInfo(
  player: VrplPlayer,
  User: APIUser,
  userId: ObjectId
) {
  const oldDiscordAvatar = player.discordAvatar;
  const oldDiscordTag = player.discordTag;
  const oldDiscordId = player.discordId;

  player.discordAvatar = User.avatar || undefined;
  player.discordTag = `${User.username}#${User.discriminator}`;
  player.discordId = User.id;

  const records = [];
  if (oldDiscordTag !== player.discordTag) {
    records.push({
      id: uuidv4(),
      type: recordType.playerUpdate,
      playerId: player.id,
      old: oldDiscordTag,
      new: player.discordTag,
      performedByPlayerId: player.id,
      performedByUserId: userId,
      timestamp: new Date(),
      v: 1,
      valueChanged: "discordTag",
    } as playerUpdateRecord);
  }
  if (oldDiscordId !== player.discordId) {
    records.push({
      id: uuidv4(),
      type: recordType.playerUpdate,
      playerId: player.id,
      old: oldDiscordId,
      new: player.discordId,
      performedByPlayerId: player.id,
      performedByUserId: userId,
      timestamp: new Date(),
      v: 1,
      valueChanged: "discordId",
    } as playerUpdateRecord);
  }
  if (oldDiscordAvatar !== player.discordAvatar) {
    records.push({
      id: uuidv4(),
      type: recordType.playerUpdate,
      playerId: player.id,
      old: oldDiscordAvatar,
      new: player.discordAvatar,
      performedByPlayerId: player.id,
      performedByUserId: userId,
      timestamp: new Date(),
      v: 1,
      valueChanged: "discordAvatar",
    } as playerUpdateRecord);
  }
  await Promise.all([
    VrplPlayerDB.updateOne(
      { id: player.id },
      {
        $set: {
          discordAvatar: player.discordAvatar,
          discordTag: player.discordTag,
          discordId: player.discordId,
        },
      }
    ),
    records.length > 0 ? storeAndBroadcastRecords(records) : undefined,
  ]);
  return player;
}

export async function createPlayerFromDiscordInfo(discordUser: APIUser) {
  if (!discordUser.email) throw new InternalServerError("No User email");
  let userName = cleanNameFromInput(discordUser.username);
  if (await getPlayerFromNickname(userName)) {
    userName = cleanNameFromInput(userName + uuidv4());
    if (await getPlayerFromNickname(userName))
      userName = cleanNameFromInput(uuidv4());
  }

  const player = new VrplPlayerDB({
    id: uuidv4(),
    nickname: userName,
    nicknameHistory: [],
    about: `This is the profile of ${discordUser.username}!`,
    email: discordUser.email.trim().toLowerCase(),
    region: VrplRegion.UNKNOWN,

    discordId: discordUser.id,
    discordTag: `${discordUser.username}#${discordUser.discriminator}`,
    discordAvatar: discordUser.avatar || undefined,

    permissions: 0,
    badgeField: 0,
    timeCreated: new Date(),
  });
  if (await getPlayerFromId(player.id))
    throw new InternalServerError("Player with id already exists");
  const user = await createUser(player.id, 0, undefined, discordUser.id);

  await Promise.all([player.save(), recordPlayerCreate(player, user)]);
  return { player, user };
}

function recordPlayerCreate(player: VrplPlayer, user: VrplUser) {
  const record: playerCreateRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.playerCreate,
    performedByPlayerId: player.id,
    performedByUserId: user._id,
    player: player,
    playerId: player.id,
    timestamp: new Date(),
  };
  return storeAndBroadcastRecord(record);
}

//
// function recordPlayerUpdate(
//   oldPlayer: VrplPlayer,
//   newPlayer: VrplPlayer,
//   auth: VrplAuth
// ) {
//   const promises: Promise<void>[] = [];
//   const toCheck: [any, any, keyof VrplPlayer][] = [
//     [newPlayer.discordAvatar, oldPlayer.discordAvatar, "discordAvatar"],
//     [newPlayer.discordTag, oldPlayer.discordTag, "discordTag"],
//     [newPlayer.discordId, oldPlayer.discordId, "discordId"],
//     [newPlayer.nickname, oldPlayer.nickname, "nickname"],
//     [newPlayer.about, oldPlayer.about, "about"],
//     [newPlayer.badgeField, oldPlayer.badgeField, "badgeField"],
//     [newPlayer.region, oldPlayer.region, "region"],
//     [newPlayer.permissions, oldPlayer.permissions, "permissions"],
//     [newPlayer.email, oldPlayer.email, "email"],
//   ];
//   toCheck.forEach(([newValue, oldValue, key]) => {
//     if (newValue !== oldValue) {
//       promises.push(
//         recordPlayerKeyUpdate(oldPlayer.id, auth, key, oldValue, newValue)
//       );
//     }
//   });
//   return Promise.all(promises);
// }

function recordPlayerKeyUpdate(
  playerId: string,
  auth: VrplAuth,
  key: keyof VrplPlayer,
  old: any,
  newValue: any
) {
  const record: playerUpdateRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.playerUpdate,
    performedByPlayerId: auth.playerId,
    performedByUserId: auth.userId,
    playerId: playerId,
    timestamp: new Date(),
    valueChanged: key,
    old: old,
    new: newValue,
  };
  return storeAndBroadcastRecord(record);
}

export async function updatePlayerBadges(
  player: VrplPlayer,
  newBitField: number,
  auth: VrplAuth
) {
  const oldPlayer_badgeField = player.badgeField;
  player.badgeField = newBitField;

  await Promise.all([
    VrplPlayerDB.updateOne(
      { id: player.id },
      { $set: { badgeField: player.badgeField } }
    ),
    recordPlayerKeyUpdate(
      player.id,
      auth,
      "badgeField",
      oldPlayer_badgeField,
      player.badgeField
    ),
  ]);
  return player;
}

export async function updatePlayerName(
  player: VrplPlayer,
  newPlayerName: string,
  auth: VrplAuth
) {
  newPlayerName = cleanNameFromInput(newPlayerName);
  const foundPlayer = await getPlayerFromNickname(newPlayerName);
  if (foundPlayer)
    throw new BadRequestError("A player with that name already exists");
  const nicknameHistoryItem: PlayerNicknameHistoryItem = {
    nickname: player.nickname,
    replacedAt: new Date(),
  };
  const oldNickname = player.nickname;
  player.nickname = newPlayerName;
  player.nicknameHistory.push(nicknameHistoryItem);

  await Promise.all([
    VrplPlayerDB.updateOne(
      { id: player.id },
      {
        $set: { nickname: newPlayerName },
        $push: { nicknameHistory: nicknameHistoryItem },
      }
    ),
    recordPlayerKeyUpdate(
      player.id,
      auth,
      "nickname",
      oldNickname,
      player.nickname
    ),
  ]);
  return player;
}

export async function howManyOfThesePlayersExist(players: string[]) {
  const count = await VrplPlayerDB.count({ id: { $in: players } });
  return count;
}

export async function setPlayerRegion(
  player: VrplPlayer,
  newRegion: VrplRegion,
  auth: VrplAuth
) {
  const old = player.region;
  player.region = newRegion;

  await Promise.all([
    VrplPlayerDB.updateOne(
      { id: player.id },
      { $set: { region: player.region } }
    ),
    recordPlayerKeyUpdate(player.id, auth, "region", old, newRegion),
  ]);
  return player;
}

export async function findPlayerBroadly(search: string) {
  return VrplPlayerDB.findOne({
    $or: [
      { id: search },
      { discordId: search },
      { discordTag: search },
      {
        $text: {
          $search: search,
          $caseSensitive: false,
          $diacriticSensitive: false,
        },
      },
    ],
  });
}

export async function validateEmail(rawEmail: string): Promise<string> {
  if (!isValidEmailRegex(rawEmail)) throw new BadRequestError("Invalid email");
  let email = rawEmail.toLowerCase().trim();
  const foundPlayer = await VrplPlayerDB.findOne({ email: email });
  if (foundPlayer) throw new BadRequestError("That email is already in use");
  return email;
}

export async function updatePlayerEmail(
  player: VrplPlayer,
  newEmail: string,
  auth: VrplAuth
) {
  const old = player.email;
  player.email = newEmail;
  const [updateRes] = await Promise.all([
    VrplPlayerDB.updateOne(
      { id: player.id },
      { $set: { email: newEmail } }
    ).exec(),
    storeAndBroadcastRecord({
      v: 1,
      id: uuidv4(),
      type: recordType.playerUpdate,
      performedByPlayerId: auth.playerId,
      performedByUserId: auth.userId,
      playerId: player.id,
      timestamp: new Date(),
      valueChanged: "email",
      old: old,
      new: newEmail,
    }),
  ]);
  if (updateRes.matchedCount === 0)
    throw new InternalServerError("Failed to find player to update");
  else if (updateRes.modifiedCount === 0)
    throw new InternalServerError("Failed to update player");
  return player;
}

// TODO: Record/broadcast this
export async function refreshDiscordData(player: VrplPlayer) {
  const discordUser = await discord.users.fetch(player.discordId);
  if (!discordUser) throw new BadRequestError("User not found");
  player.discordTag = discordUser.tag;
  player.discordAvatar = discordUser.avatar || undefined;
  player.discordTag = discordUser.tag;
  await VrplPlayerDB.updateOne(
    { id: player.id },
    {
      $set: {
        discordTag: player.discordTag,
        discordAvatar: player.discordAvatar,
        discordName: player.discordTag,
      },
    }
  );
  return player;
}

export async function updatePlayerAbout(
  player: VrplPlayer,
  newAbout: string,
  auth: VrplAuth
) {
  const old = player.about;
  player.about = newAbout;
  const updatePromise = VrplPlayerDB.updateOne(
    { id: player.id },
    { $set: { about: player.about } }
  );
  const recPromise = storeAndBroadcastRecord({
    v: 1,
    id: uuidv4(),
    type: recordType.playerUpdate,
    performedByPlayerId: auth.playerId,
    performedByUserId: auth.userId,
    playerId: player.id,
    timestamp: new Date(),
    valueChanged: "about",
    old: old,
    new: newAbout,
  });
  const [updateRes, recRes] = await Promise.all([updatePromise, recPromise]);
  if (updateRes.matchedCount === 0)
    throw new InternalServerError("Failed to find player to update");
  else if (updateRes.modifiedCount === 0)
    throw new InternalServerError("Failed to update player");
  return player;
}

export async function setPlayerAvatarHash(
  player: VrplPlayer,
  newAvatarHash: string | null,
  auth: VrplAuth
) {
  const old = player.avatarHash;
  if (player.avatarHash === newAvatarHash) return player;
  player.avatarHash = newAvatarHash ?? undefined;
  const updatePromise = VrplPlayerDB.updateOne(
    { id: player.id },
    { $set: { avatarHash: player.avatarHash } }
  );
  const recPromise = storeAndBroadcastRecord({
    v: 1,
    id: uuidv4(),
    type: recordType.playerUpdate,
    performedByPlayerId: auth.playerId,
    performedByUserId: auth.userId,
    playerId: player.id,
    timestamp: new Date(),
    valueChanged: "avatarHash",
    old: old,
    new: newAvatarHash,
  });
  const [updateRes, recRes] = await Promise.all([updatePromise, recPromise]);
  if (updateRes.matchedCount === 0)
    throw new InternalServerError("Failed to find player to update");
  else if (updateRes.modifiedCount === 0)
    throw new InternalServerError("Failed to update player");
  return player;
}
