import ms from "ms";
import { ApiToken, ApiTokenModel } from "./models/ApiTokens";
import { VrplPlayer } from "./models/vrplPlayer";
import * as Sentry from "@sentry/node";
import { v4 as uuidv4 } from "uuid";
import {
  apiTokenCreateRecord,
  apiTokenDeleteRecord,
} from "./models/records/authentication";
import { recordType } from "./models/records";
import { storeRecord } from "./logs";

const apiKeyCache = new Map<string, ApiToken>();
let cacheTimeStamp = 0;

let fetchingApiKeys: undefined | Promise<any> | PromiseLike<any> = undefined;

export async function refreshApiTokens(force?: boolean): Promise<void> {
  if (fetchingApiKeys) await fetchingApiKeys;
  if (cacheTimeStamp + ms("1hour") < Date.now() || force) {
    cacheTimeStamp = Date.now();
    fetchingApiKeys = new Promise<void>(async (resolve, reject) => {
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
      resolve();
      fetchingApiKeys = undefined;
    });
    await fetchingApiKeys;
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
    return apiKeyCache.get(key);
  } catch (err) {
    console.trace();
    console.error(err);
    Sentry.captureException(err);
    return undefined;
  }
}

export async function newApiToken(user: VrplPlayer) {
  if (!user) throw Error("No user");
  await refreshApiTokens();
  const token: ApiToken = {
    playerId: user.id,
    apiToken: uuidv4(),
    timestamp: new Date(),
  };
  const newDocPromise = ApiTokenModel.findOneAndUpdate(
    { playerId: user.id },
    token,
    { upsert: true, new: true }
  );
  const record: apiTokenCreateRecord = {
    v: 1,
    type: recordType.apiTokenCreate,
    id: uuidv4(),
    timestamp: token.timestamp,
    token: token,
    userId: token.playerId,
  };
  const [newDoc] = await Promise.all([newDocPromise, storeRecord(record)]);
  // Remove old keys from cache
  for (const [token, data] of apiKeyCache) {
    if (data.playerId === user.id) {
      apiKeyCache.delete(token);
    }
  }
  apiKeyCache.set(token.apiToken, token);
  return apiKeyCache.get(token.apiToken);
}

// Function that removes a users api key from the database and cache
export async function removeApiToken(user: VrplPlayer) {
  if (!user) throw Error("No user");
  // Delete from database
  await ApiTokenModel.findOneAndRemove({ playerId: user.id });
  for (const [token, data] of apiKeyCache) {
    if (data.playerId === user.id) {
      const record: apiTokenDeleteRecord = {
        v: 1,
        type: recordType.apiTokenDelete,
        id: uuidv4(),
        timestamp: new Date(),
        token: data,
        userId: data.playerId,
      };
      await storeRecord(record);
      apiKeyCache.delete(token);
    }
  }
}
