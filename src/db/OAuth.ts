import {
  AllOAuthScopes,
  OAuthAuthorizationCode,
  OAuthAuthorizationCodesModel,
  OAuthClient,
  OAuthClientsModel,
  OAuthScopes,
  OauthToken,
  OAuthTokensModel,
} from "./models/OAuthModels";
import {
  AuthorizationCode,
  AuthorizationCodeModel,
  Client,
  ClientCredentialsModel,
  PasswordModel,
  RefreshTokenModel,
  Token,
  User,
} from "oauth2-server";
import { randomBytes } from "crypto";
import {
  getUserFromClient,
  getUserFromDiscordCode,
  getUserFromUsernameAndPassword,
} from "./user";
import mongoose, { ObjectId } from "mongoose";
import { VrplAuth } from "../index";
import { storeAndBroadcastRecord } from "./records";
import { v4 as uuidv4 } from "uuid";
import { generateAccessToken } from "../utils/authentication/jwt";
import { accessTokenLifetimeSecs } from "../utils/servers/createOAuthServer";
import {
  OAuthClientCreateRecord,
  OAuthClientDeleteRecord,
} from "./models/records/oauthRecords";
import { recordType } from "./models/records";

console.log("scopes", OAuthScopes);

async function getAccessToken(accessToken: string): Promise<OauthToken | null> {
  return await OAuthTokensModel.findOne({ accessToken }).exec();
}

async function getClient(
  clientId: string,
  clientSecret: string
): Promise<OAuthClient | null> {
  return await OAuthClientsModel.findOne({ clientId, clientSecret }).exec();
}

async function getAuthorizationCode(
  authorizationCode: string
): Promise<OAuthAuthorizationCode | null> {
  return await OAuthAuthorizationCodesModel.findOne({
    authorizationCode,
  }).exec();
}

async function saveToken(
  token: Token,
  client: Client,
  user: User
): Promise<OauthToken> {
  const id = new mongoose.Types.ObjectId();
  const oauthToken = new OAuthTokensModel({
    _id: id,
    id: id,
    accessToken: token.accessToken,
    accessTokenExpiresAt: token.accessTokenExpiresAt,
    refreshToken: token.refreshToken,
    refreshTokenExpiresAt: token.refreshTokenExpiresAt,
    scope: token.scope,
    user: user,
    client: client,
  });
  return await oauthToken.save();
}

async function saveAuthorizationCode(
  code: Pick<
    AuthorizationCode,
    "authorizationCode" | "expiresAt" | "redirectUri" | "scope"
  >,
  client: Client,
  user: User
): Promise<OAuthAuthorizationCode | null> {
  const oauthAuthorizationCode = new OAuthAuthorizationCodesModel({
    authorizationCode: code.authorizationCode,
    expiresAt: code.expiresAt,
    redirectUri: code.redirectUri,
    scope: code.scope,
    client: client,
    user: user,
  });
  return await oauthAuthorizationCode.save();
}

async function revokeAuthorizationCode(
  authorizationCode: string
): Promise<boolean> {
  const result = await OAuthAuthorizationCodesModel.deleteOne({
    authorizationCode,
  }).exec();
  return result.deletedCount === 1;
}

async function validateScope(
  user: User,
  client: Client,
  scope: string | string[]
) {
  if (typeof scope === "string") scope = scope.split(" ");
  // console.log("client", client);
  // console.log("validateScope", scope);
  if (!scope) return false;
  else if (
    scope.some((scope) => !OAuthScopes.includes(scope as AllOAuthScopes))
  )
    return false;
  return scope;
}

async function verifyScope(
  accessToken: Token,
  requestedScopes: string | string[]
) {
  let authorizedScopes: string[] | string = accessToken.scope || [];
  if (typeof requestedScopes === "string")
    requestedScopes = requestedScopes.split(" ");
  // console.log("requestedScopes", requestedScopes);
  // console.log("authorizedScopes", authorizedScopes);
  return requestedScopes.every((scope) => authorizedScopes.includes(scope));
}

// async function createUserWithPassword(username: string, password: string) {
//   const salt = randomBytes(32).toString("base64");
//   const iterations = 10000;
//   const keyLength = 64;
//   console.time("hashPassword");
//   const hashedPassword = await hashPassword(
//     password,
//     salt,
//     iterations,
//     keyLength
//   );
//   console.timeEnd("hashPassword");
//
//   const user = new VrplUserModel({
//     password: {
//       username,
//       salt,
//       iterations,
//       keyLength,
//       hash: hashedPassword,
//     },
//     permissions: 0,
//   });
//   console.log(user);
//   return await user.save();
// }

// setTimeout(() => createUserWithPassword("", ""), 5000);
// setTimeout(
//   () =>
//     createClient(
//       ["http://localhost:3002/callback"],
//       ["password", "authorization_code", "refresh_token", "client_credentials"],
//       new ObjectId("628101e552b0f4bc43bde58b")
//     ),
//   5000
// );

async function getRefreshToken(
  refreshToken: string
): Promise<OauthToken | null> {
  return await OAuthTokensModel.findOne({
    refreshToken,
  }).exec();
}

async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  const result = await OAuthTokensModel.deleteOne({
    refreshToken: refreshToken,
  }).exec();
  return result.deletedCount === 1;
}

// type model = ExtensionModel;

export const authorizationModel: AuthorizationCodeModel &
  PasswordModel &
  RefreshTokenModel &
  ClientCredentialsModel = {
  getAccessToken(accessToken) {
    return getAccessToken(accessToken);
  },
  getClient(clientId, clientSecret) {
    return getClient(clientId, clientSecret);
  },
  getAuthorizationCode(authorizationCode) {
    return getAuthorizationCode(authorizationCode);
  },
  saveToken(token, client, user) {
    return saveToken(token, client, user);
  },
  saveAuthorizationCode(code, client, user) {
    return saveAuthorizationCode(code, client, user);
  },
  revokeAuthorizationCode(code): Promise<boolean> {
    return revokeAuthorizationCode(code.authorizationCode);
  },
  validateScope(user, client, scope) {
    return validateScope(user, client, scope);
  },
  verifyScope(token, scope) {
    return verifyScope(token, scope);
  },

  // PasswordModel
  getUser(username, password) {
    if (username === "discord") return getUserFromDiscordCode(password);
    else return getUserFromUsernameAndPassword(username, password);
  },

  // RefreshTokenModel
  getRefreshToken(refreshToken: string) {
    return getRefreshToken(refreshToken);
  },
  revokeToken(token) {
    const refreshToken = token.refreshToken;
    if (!refreshToken) throw new Error("[revokeToken] No refresh token");
    return revokeRefreshToken(refreshToken);
  },

  // ClientCredentialsModel
  getUserFromClient(client) {
    // TODO: Test this
    return getUserFromClient(client as OAuthClient);
  },

  async generateAccessToken(
    client: Client,
    user: User,
    scope: string | string[]
  ): Promise<string> {
    if (typeof scope === "string") scope = scope.split(" ");
    return generateAccessToken({
      playerId: user.playerId,
      permissions: user.permissions,
      scope: scope,
      expiresInSecs: accessTokenLifetimeSecs,
      clientId: client.id,
    });
  },
};
//
// class DiscordGrantType extends AbstractGrantType {
//   handle(request: Request, client: Client): Promise<OauthToken | Falsey> {
//     // request.body.
//
//     return Promise.resolve(undefined);
//   }
//
//   async generateAccessToken(
//     client: Client,
//     user: VrplUser,
//     scope: string | string[]
//   ): Promise<string> {
//     if (typeof scope === "string") scope = scope.split(" ");
//     return generateAccessToken({
//       playerId: user.playerId,
//       permissions: user.permissions,
//       scope: scope,
//       expiresInSecs: accessTokenLifetimeSecs,
//       clientId: client.id,
//     });
//   }
//
//   async generateRefreshToken(
//     client: Client,
//     user: User,
//     scope: string | string[]
//   ): Promise<string> {
//     return generateRefreshToken();
//   }
//
//   getAccessTokenExpiresAt(): Date {
//     return new Date(Date.now() + accessTokenLifetimeSecs * 1000);
//   }
//
//   getRefreshTokenExpiresAt(): Date {
//     return new Date(Date.now() + refreshTokenLifetimeSecs * 1000);
//   }
//
//   validateScope(
//     user: User,
//     client: Client,
//     scope: string | string[]
//   ): Promise<string | string[] | Falsey> {
//     return validateScope(user, client, scope);
//   }
//
//   getScope(request: Request): string {
//     return request.body.scope;
//   }
// }

export async function getOauthClientFromClientId(clientId: string) {
  return await OAuthClientsModel.findOne({
    clientId: clientId,
  }).exec();
}

export async function getOauthClientsOfUser(userId: ObjectId) {
  return await OAuthClientsModel.find({
    userId: userId,
  }).exec();
}

export async function createOAuth2Client(
  clientName: string,
  redirectUris: string[],
  grants: string[],
  userId: ObjectId,
  auth: VrplAuth
) {
  const clientId = new mongoose.Types.ObjectId();
  const clientSecret = randomBytes(64).toString("base64url");
  const client = new OAuthClientsModel({
    id: clientId,
    clientName,
    createdAt: new Date(),
    verified: false,
    clientId,
    clientSecret,
    grants,
    redirectUris,
    accessTokenLifetime: 3600,
    refreshTokenLifetime: 1209600,
    userId: userId,
  });
  const record: OAuthClientCreateRecord = {
    id: uuidv4(),
    client: client,
    type: recordType.OAuthClientCreate,
    clientId: client.clientId,
    v: 1,
    performedByPlayerId: auth.playerId,
    performedByUserId: auth.userId,
    timestamp: new Date(),
  };
  return (
    await Promise.all([client.save(), storeAndBroadcastRecord(record)])
  )[0];
}

export async function deleteOAuth2Client(client: OAuthClient, auth: VrplAuth) {
  const record: OAuthClientDeleteRecord = {
    id: uuidv4(),
    client: client,
    type: recordType.OAuthClientDelete,
    clientId: client.clientId,
    v: 1,
    performedByPlayerId: auth.playerId,
    performedByUserId: auth.userId,
    timestamp: new Date(),
  };
  await Promise.all([
    OAuthClientsModel.deleteOne({
      id: client.id,
    }).exec(),
    storeAndBroadcastRecord(record),
  ]);
}
