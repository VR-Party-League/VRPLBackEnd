import ms from "ms";
import VrplGameDB, { VrplGame } from "./models/vrplGame";

let gameCacheTimestamp: number = 0;
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
export async function refreshGames(force?: boolean): Promise<void> {
  if (gameCacheTimestamp + ms("24hour") < Date.now() || force) {
    gameCacheTimestamp = Date.now();
    const games = await VrplGameDB.find({});
    gameCache.clear();
    for (let RawGame of games) {
      storeGame(RawGame);
    }
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

export async function getGamesArray() {
  await refreshGames();
  return Array.from(gameCache.values());
}
