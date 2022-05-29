import OAuth2Server from "oauth2-server";
import { authorizationModel } from "../../db/OAuth";

export const accessTokenLifetimeSecs = 3600;
export const refreshTokenLifetimeSecs = 90 * 24 * 3600;
export const authorizationCodeLifetimeSecs = 5 * 60;
const OAuthServer = new OAuth2Server({
  model: authorizationModel, // See https://github.com/oauthjs/node-oauth2-server for specification
  accessTokenLifetime: accessTokenLifetimeSecs,
  refreshTokenLifetime: refreshTokenLifetimeSecs,
  authorizationCodeLifetime: authorizationCodeLifetimeSecs,

  allowExtendedTokenAttributes: true,
  allowEmptyState: true,
});

export default OAuthServer;
