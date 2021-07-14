import ms from "ms";
import { ApiToken, ApiTokenModel } from "./models/ApiTokens";
import { VrplPlayer } from "./models/vrplPlayer";
import { v4 as uuidv4 } from "uuid";

const apiKeyCache = new Map<string, ApiToken>();
let cacheTimeStamp = 0;

export async function refreshApiTokens(force?: boolean): Promise<void> {
  if (cacheTimeStamp + ms("1hour") < Date.now() || force) {
    cacheTimeStamp = Date.now();
    const ApiTokens = await ApiTokenModel.find({});
    apiKeyCache.clear();
    for (let RawApiToken of ApiTokens) {
      const ApiToken: ApiToken = {
        playerId: RawApiToken.playerId,
        apiToken: RawApiToken.apiToken,
        timestamp: RawApiToken.timestamp,
        //Uses: RawApiToken.Uses,
      };
      apiKeyCache.set(ApiToken.apiToken, ApiToken);
    }
  } else if (cacheTimeStamp + ms("10seconds") < Date.now()) {
    cacheTimeStamp = Date.now();
    ApiTokenModel.find({}).then((ApiTokens) => {
      apiKeyCache.clear();
      for (let RawApiToken of ApiTokens) {
        const ApiToken: ApiToken = {
          playerId: RawApiToken.playerId,
          apiToken: RawApiToken.apiToken,
          timestamp: RawApiToken.timestamp,
          //Uses: RawApiToken.Uses,
        };
        apiKeyCache.set(ApiToken.apiToken, ApiToken);
      }
    });
  }
}

export async function getUserFromKey(
  key: string
): Promise<ApiToken | undefined> {
  try {
    await refreshApiTokens();
    console.log(apiKeyCache);
    return apiKeyCache.get(key);
  } catch (err) {
    console.trace();
    console.error(err);
    return undefined;
  }
}

export async function newApiToken(user: VrplPlayer) {
  if (!user) throw Error("No user");
  await refreshApiTokens();
  const newDoc = await ApiTokenModel.findOneAndUpdate(
    { playerId: user.id },
    { playerId: user.id, apiToken: uuidv4(), timestamp: new Date() },
    { upsert: true, new: true }
  );
  // Remove old keys from cache
  for (const key of apiKeyCache) {
    if (key[1].playerId === user.id) {
      apiKeyCache.delete(key[0]);
    }
  }
  apiKeyCache.set(newDoc.apiToken, {
    playerId: newDoc.playerId,
    apiToken: newDoc.apiToken,
    timestamp: newDoc.timestamp,
  });
  return apiKeyCache.get(newDoc.apiToken);
}
