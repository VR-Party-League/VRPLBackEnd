import axios, { AxiosError } from "axios";
import * as Sentry from "@sentry/node";

import { APIUser, RESTPostOAuth2AccessTokenResult } from "discord-api-types/v9";
import { frontEndUrl } from "../../index";
import { URLSearchParams } from "url";
import { BadRequestError, InternalServerError } from "../errors";

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

export async function getDiscordOAuthDataFromCode(code: string) {
  let OAuthData: RESTPostOAuth2AccessTokenResult;
  try {
    const redirectUri = `${frontEndUrl}/api/auth/discord/callback`;
    const data = new URLSearchParams({
      client_id: process.env.CLIENT_ID as string,
      client_secret: process.env.CLIENT_SECRET as string,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      scope: "email%20identify",
    }).toString();
    // console.log("DATA:", data);
    const response = await axios.post(
      "https://discord.com/api/oauth2/token",
      data,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    OAuthData = response.data;
  } catch (e) {
    console.error((e as AxiosError).response?.data, (e as AxiosError).request);
    Sentry.captureException(e);
    throw new BadRequestError("Invalid discord code");
  }
  if (!OAuthData.access_token)
    throw new InternalServerError("No discord access token got from code");
  return OAuthData;
}

export async function getDiscordUserFromOAuthData(
  oauthData: RESTPostOAuth2AccessTokenResult
): Promise<APIUser> {
  try {
    const userResult = await axios.get("https://discord.com/api/users/@me", {
      headers: {
        authorization: `${oauthData.token_type} ${oauthData.access_token}`,
      },
    });
    return userResult.data;
  } catch (e) {
    console.error(e);
    Sentry.captureException(e);
    throw new InternalServerError("Could not get discord user from oauth data");
  }
}

export function getOAuthUrl(serverUrl: string) {
  const client_id = process.env.CLIENT_ID;
  const redirect_uri = `${serverUrl}/api/auth/discord/callback`;

  const url = `https://discord.com/api/oauth2/authorize?client_id=${client_id}&redirect_uri=${encodeURI(
    redirect_uri
  )}&response_type=code&scope=email%20identify`;
  return url;
}
