import VrplUserModel, { VrplUser } from "./models/vrplUser";
import { pbkdf2, randomBytes } from "crypto";
import { OAuthClient } from "./models/OAuthModels";
import { User } from "oauth2-server";
import {
  getDiscordOAuthDataFromCode,
  getDiscordUserFromOAuthData,
} from "../utils/authentication/discord";
import { createPlayerFromDiscordInfo } from "./player";

export async function getUserFromUsername(username: string) {
  return await VrplUserModel.findOne({ "password.username": username }).exec();
}

function hashPassword(
  password: string,
  salt: string,
  iterations: number,
  keyLength: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, iterations, keyLength, "sha512", (err, key) => {
      if (err) reject(err);
      else resolve(key.toString("base64"));
    });
  });
}

export async function createUser(
  playerId: string,
  permissions: number,
  password?: {
    password: string;
    username: string;
  },
  discordId?: string
) {
  const salt = randomBytes(32).toString("base64");
  const iterations = 10000;
  const keyLength = 64;
  let hashedPassword: string | undefined = undefined;
  let username: string | undefined = undefined;
  if (password) {
    hashedPassword = await hashPassword(
      password.password,
      salt,
      iterations,
      keyLength
    );
    username = password.username;
  }
  const user = new VrplUserModel({
    permissions,
    password: hashedPassword
      ? {
          salt,
          iterations,
          keyLength,
          username: username,
          password: hashedPassword,
        }
      : undefined,
    discordId: discordId,
    playerId: playerId,
  });
  return user.save();
}

export async function getUserFromUsernameAndPassword(
  username: string,
  password: string
): Promise<VrplUser | null> {
  const user = await getUserFromUsername(username);
  if (!user || !user.password) return null;
  console.time("verifyPassword");
  const hashedPassword = await hashPassword(
    password,
    user.password.salt,
    user.password.iterations,
    user.password.keyLength
  );
  console.timeEnd("verifyPassword");
  if (hashedPassword === user.password.hash) return user;
  else return null;
}

export async function getUserFromDiscordCode(code: string) {
  const oauthData = await getDiscordOAuthDataFromCode(code);
  const discordUser = await getDiscordUserFromOAuthData(oauthData);
  const user = await VrplUserModel.findOne({
    discordId: discordUser.id,
  }).exec();
  if (!user) {
    const userAndPlayer = await createPlayerFromDiscordInfo(discordUser);
    return userAndPlayer.user;
  }
  return user;
}

export async function getUserFromClient(
  client: OAuthClient
): Promise<User | null> {
  return await VrplUserModel.findById(client.userId).exec();
}

export async function getUserFromPlayerId(
  playerId: string
): Promise<VrplUser | null> {
  return await VrplUserModel.findOne({ playerId: playerId }).exec();
}
