import ms from "ms";
import VrplPlayerDB, { VrplPlayer } from "../db/models/vrplPlayer";
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

let playerCacheTimeStamp: number = 0;
const playerCache = new Map<string, VrplPlayer>();

let fetchingPlayers: undefined | Promise<any> | PromiseLike<any> = undefined;

export function storePlayer(RawPlayer: VrplPlayer) {
  const player: VrplPlayer = {
    id: RawPlayer.id,
    about: RawPlayer.about,
    email: RawPlayer.email,
    nickname: RawPlayer.nickname,
    nicknameHistory: RawPlayer.nicknameHistory,
    region: RawPlayer.region,

    discordId: RawPlayer.discordId,
    discordTag: RawPlayer.discordTag,
    discordAvatar: RawPlayer.discordAvatar,

    badgeField: RawPlayer.badgeField,
    timeCreated: RawPlayer.timeCreated,
    permissions: RawPlayer.permissions,
  };
  playerCache.set(player.id, player);
  return player;
}

export async function refreshPlayers(force?: boolean): Promise<void> {
  if (fetchingPlayers) await fetchingPlayers;
  if (playerCacheTimeStamp + ms("1hour") < Date.now() || force) {
    playerCacheTimeStamp = Date.now();
    fetchingPlayers = new Promise<void>(async (resolve, reject) => {
      const players = await VrplPlayerDB.find({});
      playerCache.clear();
      for (let RawPlayer of players) {
        storePlayer(RawPlayer);
      }
      resolve();
      fetchingPlayers = undefined;
    });
    await fetchingPlayers;
  } else if (playerCacheTimeStamp + ms("10seconds") < Date.now()) {
    playerCacheTimeStamp = Date.now();
    VrplPlayerDB.find({}).then((players) => {
      playerCache.clear();
      for (let RawPlayer of players) {
        storePlayer(RawPlayer);
      }
    });
  }
}

export async function getPlayerFromId(
  PlayerId: string
): Promise<VrplPlayer | null> {
  try {
    await refreshPlayers();
    return playerCache.get(PlayerId) || null;
  } catch (err) {
    console.trace();
    console.error(err);
    Sentry.captureException(err);
    return null;
  }
}

export async function getAllPlayerIds() {
  const data = await VrplPlayerDB.find({}, { id: 1 });
  return data.map((player) => player.id);
}

type findFunc = (Team: VrplPlayer) => boolean | undefined | null;

async function findPlayer(findFunc: findFunc) {
  await refreshPlayers();
  const playerIterable = playerCache.values();
  for (const player of playerIterable) {
    if (findFunc(player)) return player;
  }
}

export async function getPlayerFromNickname(nickname: string) {
  return findPlayer(
    (player) =>
      cleanNameForChecking(player.nickname) === cleanNameForChecking(nickname)
  );
}

export async function getPlayerFromDiscordTag(discordTag: string) {
  return (
    (await findPlayer((player) => player.discordTag == discordTag)) ||
    (await findPlayer(
      (player) => player.discordTag.toLowerCase() == discordTag.toLowerCase()
    ))
  );
}

export async function getPlayerFromDiscordId(discordId: string) {
  return (await findPlayer((player) => player.discordId == discordId)) || null;
}

export async function updatePlayerDiscordInfo(
  Player: VrplPlayer,
  User: APIUser
) {
  const oldPlayer = Object.assign({}, Player);
  Player.discordAvatar = User.avatar || undefined;
  Player.discordTag = `${User.username}#${User.discriminator}`;
  Player.discordId = User.id;

  playerCache.delete(Player.id);
  storePlayer(Player);
  await Promise.all([
    VrplPlayerDB.updateOne({ id: oldPlayer.id }, Player),
    recordPlayerUpdate(oldPlayer, Player),
  ]);
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
    region: undefined,

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
  return storePlayer(player);
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
  const old = player.badgeField;
  player.badgeField = newBitField;
  const playerUpdateRecord: playerUpdateRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.playerUpdate,
    userId: performedBy,
    playerId: player.id,
    timestamp: new Date(),
    valueChanged: "badgeField",
    old: old,
    new: player.badgeField,
  };
  await Promise.all([
    VrplPlayerDB.updateOne(
      { id: player.id },
      { $set: { badgeField: player.badgeField } }
    ),
    storeRecord(playerUpdateRecord),
  ]);
  return storePlayer(player);
}
export async function updatePlayerName(
  player: VrplPlayer,
  newPlayerName: string,
  performedBy: string
) {
  const foundPlayer = await getPlayerFromNickname(newPlayerName);
  if (foundPlayer)
    throw new BadRequestError("A player with that name already exists");
  newPlayerName = cleanNameFromInput(newPlayerName);
  const nicknameHistoryItem: PlayerNicknameHistoryItem = {
    nickname: player.nickname,
    replacedAt: new Date(),
  };
  player.nickname = newPlayerName;
  player.nicknameHistory.push(nicknameHistoryItem);

  const playerUpdateRecord: playerUpdateRecord = {
    v: 1,
    id: uuidv4(),
    type: recordType.playerUpdate,
    userId: performedBy,
    playerId: player.id,
    timestamp: new Date(),
    valueChanged: "nickname",
    old: nicknameHistoryItem.nickname,
    new: player.nickname,
  };
  await Promise.all([
    VrplPlayerDB.updateOne(
      { id: player.id },
      {
        $set: { nickname: newPlayerName },
        $push: { nicknameHistory: nicknameHistoryItem },
      }
    ),
    storeRecord(playerUpdateRecord),
  ]);
  return storePlayer(player);
}
