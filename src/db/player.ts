import ms from "ms";
import VrplPlayerDB, { VrplRegion, VrplPlayer } from "../db/models/vrplPlayer";
import {
  playerCreateRecord,
  playerUpdateRecord,
} from "./models/records/playerRecords";
import * as Sentry from "@sentry/node";
import { v4 as uuidv4 } from "uuid";
import { recordType } from "./models/records";
import { storeRecord } from "./logs";

import { APIUser } from "discord-api-types/v9";
import {
  cleanNameForChecking,
  cleanNameFromInput,
} from "../utils/regex/player";
import { PlayerNicknameHistoryItem } from "../schemas/Player";
import { BadRequestError } from "../utils/errors";
import vrplPlayer from "../db/models/vrplPlayer";

export async function getPlayerFromId(PlayerId: string) {
  return await VrplPlayerDB.findOne({ id: PlayerId });
}
export async function getPlayersFromIds(playerIds: string[]) {
  return await VrplPlayerDB.find({ id: { $in: playerIds } });
}

export async function getAllPlayerIds() {
  const data = await VrplPlayerDB.find({}, { id: 1 });
  return data.map((player) => player.id);
}

export async function getPlayerFromNickname(nickname: string) {
  return await VrplPlayerDB.findOne({
    $text: {
      $search: nickname,
      $caseSensitive: false,
      $diacriticSensitive: false,
    },
  });
  // TODO: should this be fuzzy?
}

export async function getPlayerFromDiscordTag(discordTag: string) {
  return await VrplPlayerDB.findOne({ discordTag: discordTag });
}

export async function getPlayerFromDiscordId(discordId: string) {
  return await VrplPlayerDB.findOne({ discordId: discordId });
}

export async function updatePlayerDiscordInfo(
  Player: VrplPlayer,
  User: APIUser
) {
  const oldPlayer = Object.assign({}, Player);
  Player.discordAvatar = User.avatar || undefined;
  Player.discordTag = `${User.username}#${User.discriminator}`;
  Player.discordId = User.id;

  await Promise.all([
    VrplPlayerDB.updateOne(
      { id: oldPlayer.id },
      {
        $set: {
          discordAvatar: Player.discordAvatar,
          discordTag: Player.discordTag,
          discordId: Player.discordId,
        },
      }
    ),
    recordPlayerUpdate(oldPlayer, Player),
  ]);
  return Player;
}
export async function createPlayerFromDiscordInfo(
  User: APIUser
): Promise<VrplPlayer> {
  if (!User.email) throw new Error("No User email");
  let userName = cleanNameFromInput(User.username);
  if (await getPlayerFromNickname(userName)) {
    userName = cleanNameFromInput(userName + uuidv4());
    if (await getPlayerFromNickname(userName))
      userName = cleanNameFromInput(uuidv4());
  }

  const player: VrplPlayer = {
    id: uuidv4(),
    nickname: userName,
    nicknameHistory: [],
    about: `This is the profile of ${User.username}!`,
    email: User.email,
    region: VrplRegion.UNKNOWN,

    discordId: User.id,
    discordTag: `${User.username}#${User.discriminator}`,
    discordAvatar: User.avatar || undefined,

    permissions: 0,
    badgeField: 0,
    timeCreated: new Date(),
  };
  if (await getPlayerFromId(player.id))
    return createPlayerFromDiscordInfo(User);

  await Promise.all([VrplPlayerDB.create(player), recordPlayerCreate(player)]);
  return player;
}

function recordPlayerCreate(player: VrplPlayer) {
  const record: playerCreateRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.playerCreate,
    userId: player.id,
    player: player,
    playerId: player.id,
    timestamp: new Date(),
  };
  return storeRecord(record);
}

function recordPlayerUpdate(oldPlayer: VrplPlayer, newPlayer: VrplPlayer) {
  const promises: Promise<void>[] = [];
  const toCheck: [any, any, keyof VrplPlayer][] = [
    [newPlayer.discordAvatar, oldPlayer.discordAvatar, "discordAvatar"],
    [newPlayer.discordTag, oldPlayer.discordTag, "discordTag"],
    [newPlayer.discordId, oldPlayer.discordId, "discordId"],
    [newPlayer.nickname, oldPlayer.nickname, "nickname"],
    [newPlayer.about, oldPlayer.about, "about"],
    [newPlayer.badgeField, oldPlayer.badgeField, "badgeField"],
    [newPlayer.region, oldPlayer.region, "region"],
    [newPlayer.permissions, oldPlayer.permissions, "permissions"],
  ];
  toCheck.forEach(([newValue, oldValue, key]) => {
    if (newValue !== oldValue) {
      promises.push(
        recordPlayerKeyUpdate(oldPlayer.id, key, oldValue, newValue)
      );
    }
  });
  return Promise.all(promises);
}

function recordPlayerKeyUpdate(
  playerId: string,
  key: keyof VrplPlayer,
  old: any,
  newValue: any
) {
  const record: playerUpdateRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.playerUpdate,
    userId: playerId,
    playerId: playerId,
    timestamp: new Date(),
    valueChanged: key,
    old: old,
    new: newValue,
  };
  return storeRecord(record);
}

export async function updatePlayerBadges(
  player: VrplPlayer,
  newBitField: number,
  performedBy: string
) {
  const oldPlayer = Object.assign({}, player);
  player.badgeField = newBitField;

  await Promise.all([
    VrplPlayerDB.updateOne(
      { id: player.id },
      { $set: { badgeField: player.badgeField } }
    ),
    recordPlayerUpdate(oldPlayer, player),
  ]);
  return player;
}
export async function updatePlayerName(
  player: VrplPlayer,
  newPlayerName: string,
  performedBy: string
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
    recordPlayerKeyUpdate(player.id, "nickname", oldNickname, player.nickname),
  ]);
  return player;
}

export async function howManyOfThesePlayersExist(players: string[]) {
  const count = await VrplPlayerDB.count({ id: { $in: players } });
  return count;
}

export async function setPlayerRegion(
  player: VrplPlayer,
  newRegion: VrplRegion
) {
  const old = player.region;
  player.region = newRegion;

  await Promise.all([
    VrplPlayerDB.updateOne(
      { id: player.id },
      { $set: { region: player.region } }
    ),
    recordPlayerKeyUpdate(player.id, "region", old, newRegion),
  ]);
  return player;
}

export async function findPlayerBroadly(search: string) {
  return await VrplPlayerDB.findOne({
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
