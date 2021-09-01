import ms from "ms";
import VrplGameDB, { VrplGame } from "./models/vrplGame";

let gameCacheTimestamp: number = 0;
let fetchingGames: undefined | Promise<any> | PromiseLike<any> = undefined;
const gameCache = new Map<string, VrplGame>();

function storeGame(rawGame: VrplGame) {
  const match: VrplGame = {
    id: rawGame.id,
    name: rawGame.name,
    banner: rawGame.banner,
    description: rawGame.description,
    fields: rawGame.fields.map((field) => Object.assign({}, field)),
  };
  gameCache.set(match.id, match);
  return match;
}

async function refreshGames(force?: boolean): Promise<void> {
  if (fetchingGames) await fetchingGames;
  if (gameCacheTimestamp + ms("24hour") < Date.now() || force) {
    gameCacheTimestamp = Date.now();
    fetchingGames = new Promise<void>((resolve, reject) => {
      VrplGameDB.find({}).then((games) => {
        gameCache.clear();
        for (let RawGame of games) {
          storeGame(RawGame);
        }
        resolve();
        fetchingGames = undefined;
      });
    });
    await fetchingGames;
  } else if (gameCacheTimestamp + ms("1hour") < Date.now()) {
    gameCacheTimestamp = Date.now();
    VrplGameDB.find({}).then((games) => {
      gameCache.clear();
      for (let RawGame of games) {
        storeGame(RawGame);
      }
    });
  }
}

// Gets a game by its id
export async function getGameById(id: string): Promise<VrplGame | null> {
  await refreshGames();
  return gameCache.get(id) ?? null;
}

// Get game from name
export async function getGameFromName(name: string): Promise<VrplGame | null> {
  await refreshGames();
  for (let game of gameCache.values()) {
    if (
      game.name.trim().toLowerCase().replace(/\s/g, "") ===
      name.trim().toLowerCase().replace(/\s/g, "")
    )
      return game;
  }
  return null;
}

export async function getGamesArray() {
  await refreshGames();
  return Array.from(gameCache.values());
}
