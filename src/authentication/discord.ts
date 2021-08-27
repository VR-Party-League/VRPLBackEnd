import { VrplPlayer } from "../db/models/vrplPlayer";
import axios from "axios";

import { v4 as uuidv4 } from "uuid";
import { APIUser, RESTPostOAuth2AccessTokenResult } from "discord-api-types/v9";

// {
//   id: '325893549071663104',
//   username: 'Fish',
//   avatar: 'a_22fcd93b3b86ab15c83c1ed831ff7533',
//   discriminator: '2455',
//   public_flags: 256,
//   flags: 256,
//   banner: '2292006e1b6eac52956b6462399aec1b',
//   banner_color: '#1059f1',
//   accent_color: 1071601,
//   locale: 'en-US',
//   mfa_enabled: true,
//   premium_type: 2
// }
export async function getUserFromOAuthData(
  oauthData: RESTPostOAuth2AccessTokenResult
): Promise<APIUser> {
  const userResult = await axios.get("https://discord.com/api/users/@me", {
    headers: {
      authorization: `${oauthData.token_type} ${oauthData.access_token}`,
    },
  });
  return userResult.data;
}

export function getRedirectUri() {
  const redirect_uri_base =
    process.env.NODE_ENV === "production"
      ? `https://vrpl-graphql.herokuapp.com`
      : `http://localhost:3001`;
  const redirect_uri = `${redirect_uri_base}/api/auth/discord/callback`;
  return redirect_uri;
}
export function getOAuthUrl() {
  const client_id = process.env.CLIENT_ID;
  const redirect_uri = getRedirectUri();
  const url = `https://discord.com/api/oauth2/authorize?client_id=${client_id}&redirect_uri=${encodeURI(
    redirect_uri
  )}&response_type=code&scope=identify`;
  return url;
}
