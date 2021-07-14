import ms from "ms";
import VrplPlayerDB, { VrplPlayer } from "../db/models/vrplPlayer";

let playerCacheTimeStamp: number = 0;
const playerCache = new Map<string, VrplPlayer>();

export function storePlayer(RawPlayer: VrplPlayer) {
  const player: VrplPlayer = {
    id: RawPlayer.id,
    discordId: RawPlayer.discordId,
    discordTag: RawPlayer.discordTag,
    discordAvatar: RawPlayer.discordAvatar,
    permissions: RawPlayer.permissions,
  };
  playerCache.set(player.id, player);
  return player;
}

export async function refreshPlayers(force?: boolean): Promise<void> {
  if (playerCacheTimeStamp + ms("1hour") < Date.now() || force) {
    playerCacheTimeStamp = Date.now();
    const players = await VrplPlayerDB.find({});
    playerCache.clear();
    for (let RawPlayer of players) {
      storePlayer(RawPlayer);
    }
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

export async function getPlayerFromID(
  PlayerID: string
): Promise<VrplPlayer | undefined> {
  try {
    await refreshPlayers();
    return playerCache.get(PlayerID);
  } catch (err) {
    console.trace();
    console.error(err);
    return undefined;
  }
}

type findFunc = (Team: VrplPlayer) => boolean | undefined | null;

async function findPlayer(findFunc: findFunc) {
  await refreshPlayers();
  const playerIterable = playerCache.values();
  for (const player of playerIterable) {
    if (findFunc(player)) return player;
  }
}

export async function getPlayersFromDiscordTag(discordTag: string) {
  return (
    (await findPlayer((player) => player.discordTag == discordTag)) ||
    (await findPlayer(
      (player) => player.discordTag.toLowerCase() == discordTag.toLowerCase()
    ))
  );
}

// export async function filterPlayers(filterFunc: findFunc) {
//   await refreshPlayers();
//   const teamIterable = playerCache.values();
//   const response = [];
//   for (const player of teamIterable) {
//     if (filterFunc(player)) response.push(player);
//   }
//   return response;
// }
// export async function discordTagToID(
//   DiscordTag: string
// ): Promise<string | null> {
//   if (!DiscordTag || typeof DiscordTag !== "string") return null;
//   let Player = await findPlayer((player) => player.DiscordTag === DiscordTag);
//   if (!Player)
//     Player = await findPlayer(
//       (player) => player.discordTag.toLowerCase() === DiscordTag.toLowerCase()
//     );
//   return Player?.DiscordID || null;
// }

// export async function discordTagToPlayer(
//   DiscordTag: string
// ): Promise<VrplPlayer | null> {
//   if (!DiscordTag || typeof DiscordTag !== "string") return null;
//   let Player = await findPlayer((player) => player.DiscordTag === DiscordTag);
//   if (!Player)
//     Player = await findPlayer(
//       (player) => player.DiscordTag.toLowerCase() === DiscordTag.toLowerCase()
//     );
//   return Player || null;
// }
