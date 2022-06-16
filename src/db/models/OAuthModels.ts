import { model, Document, Schema, ObjectId } from "mongoose";
import { VrplPlayer } from "./vrplPlayer";
import { AuthorizationCode, Client, Token, User } from "oauth2-server";
import { VrplUser } from "./vrplUser";

/**
 * OAuth Tokens
 */

const OAuthReadScopes = [
  "player.email",
  "player.discordId",
  "messages",
  "oauth2.client.clientSecret",
  "oauth2.apiToken",
  "player",
] as const;
const OauthWriteScopes = [
  "player.email",
  "player.region",
  "player.nickname",
  "player.about",
  "player.discordInfo",
  "player.avatar", // TODO: Implement
  "messages.actions",
  "messages.hide",
  "messages.read",
  "team.name",
  "team.teamPlayers",
  "team.owner", // Also delete and create
  "team.socials",
  "oauth2.client",
  "oauth2.apiToken",
  "match",
] as const;
type AllOAuthWriteScopes = `${typeof OauthWriteScopes[number]}:write`;
type AllOAuthReadScopes = `${typeof OAuthReadScopes[number]}:read`;
export type AllOAuthScopes =
  | AllOAuthReadScopes
  | AllOAuthWriteScopes
  | "USE_PERMISSIONS";
export const OAuthScopes = [
  ...OAuthReadScopes.map((s) => `${s}:read`),
  ...OauthWriteScopes.map((s) => `${s}:write`),
  "USE_PERMISSIONS",
] as AllOAuthScopes[];

export interface OauthToken extends Token {
  id: string;
  client: OAuthClient;
  user: VrplUser;
  refreshToken: string;
}

const OAuthTokensSchema = new Schema<OauthToken>(
  {
    id: { type: String, required: true, unique: true },
    accessToken: { type: String },
    accessTokenExpiresAt: { type: Date },
    refreshToken: { type: String },
    refreshTokenExpiresAt: { type: Date },
    user: { type: Object },
    client: { type: Object }, // `client` and `user` are required in multiple places, for example `getAccessToken()`
    scope: Schema.Types.Mixed,
  },
  { collection: "OAuthTokens" }
);

export const OAuthTokensModel = model("OAuthTokens", OAuthTokensSchema);

/**
 * OAuth Clients
 */

export interface OAuthClient extends Client {
  verified: boolean;
  clientName: string;
  clientId: string;
  clientSecret: string;
  userId: ObjectId;
  createdAt: Date;
}

export const OAuthClientsModel = model(
  "OAuthClients",
  new Schema<OAuthClient>(
    {
      id: { type: String, required: true, unique: true },
      verified: { type: Boolean, required: true },
      clientName: { type: String, required: true },
      clientId: { type: String, required: true },
      clientSecret: { type: String, required: true },
      redirectUris: Schema.Types.Mixed,
      grants: Schema.Types.Mixed,
      accessTokenLifetime: { type: Number },
      refreshTokenLifetime: { type: Number },
      createdAt: { type: Date, required: true },
      userId: { type: Schema.Types.ObjectId, required: true },
    },
    { collection: "OAuthClients" }
  )
);

/**
 * OAuth Codes
 */

export interface OAuthAuthorizationCode extends AuthorizationCode {
  id: string;
  client: OAuthClient;
  user: VrplPlayer;
}

export const OAuthAuthorizationCodesModel = model(
  "OAuthAuthorizationCodes",
  new Schema<OAuthAuthorizationCode>(
    {
      id: { type: String, required: true, unique: true },
      authorizationCode: { type: String },
      expiresAt: { type: Date },
      redirectUri: { type: String },
      scope: Schema.Types.Mixed,
      client: { type: Object },
      user: { type: Object },
    },
    { collection: "OAuthAuthorizationCodes" }
  )
);
