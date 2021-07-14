// import ms from "ms";
// import { ApiToken, ApiTokenModel } from "./models/ApiTokens";
// import { VrplPlayer } from "./models/vrplPlayer";
// import { v4 as uuidv4 } from "uuid";

// const apiKeyCache = new Map<string, ApiToken>();
// let cacheTimeStamp = 0;

// export async function refreshApiTokens(force?: boolean): Promise<void> {
//   if (cacheTimeStamp + ms("1hour") < Date.now() || force) {
//     cacheTimeStamp = Date.now();
//     const ApiTokens = await ApiTokenModel.find({});
//     apiKeyCache.clear();
//     for (let RawApiToken of ApiTokens) {
//       const ApiToken: ApiToken = {
//         DiscordID: RawApiToken.DiscordID,
//         ApiToken: RawApiToken.ApiToken,
//         TimeStamp: RawApiToken.TimeStamp,
//         //Uses: RawApiToken.Uses,
//       };
//       apiKeyCache.set(ApiToken.ApiToken, ApiToken);
//     }
//   } else if (cacheTimeStamp + ms("10seconds") < Date.now()) {
//     cacheTimeStamp = Date.now();
//     ApiTokenModel.find({}).then((ApiTokens) => {
//       apiKeyCache.clear();
//       for (let RawApiToken of ApiTokens) {
//         const ApiToken: ApiToken = {
//           DiscordID: RawApiToken.DiscordID,
//           ApiToken: RawApiToken.ApiToken,
//           TimeStamp: RawApiToken.TimeStamp,
//           //Uses: RawApiToken.Uses,
//         };
//         apiKeyCache.set(ApiToken.ApiToken, ApiToken);
//       }
//     });
//   }
// }

// export async function getUserFromKey(
//   key: string
// ): Promise<ApiToken | undefined> {
//   try {
//     await refreshApiTokens();
//     console.log(apiKeyCache);
//     return apiKeyCache.get(key);
//   } catch (err) {
//     console.trace();
//     console.error(err);
//     return undefined;
//   }
// }

// export async function newApiToken(user: VrplPlayer) {
//   if (!user) throw Error("No user");
//   await refreshApiTokens();
//   const newDoc = await ApiTokenModel.findOneAndUpdate(
//     { DiscordID: user.DiscordID },
//     { DiscordID: user.DiscordID, ApiToken: uuidv4(), TimeStamp: new Date() },
//     { upsert: true, new: true }
//   );
//   // Remove old keys from cache
//   for (const key of apiKeyCache) {
//     if (key[1].discordID === user.discordId) {
//       apiKeyCache.delete(key[0]);
//     }
//   }
//   apiKeyCache.set(newDoc.ApiToken, {
//     DiscordID: newDoc.DiscordID,
//     ApiToken: newDoc.ApiToken,
//     TimeStamp: newDoc.TimeStamp,
//   });
//   return apiKeyCache.get(newDoc.ApiToken);
// }
