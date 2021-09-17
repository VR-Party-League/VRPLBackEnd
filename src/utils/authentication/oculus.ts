import axios from "axios";
import { URLSearchParams } from "url";
if (!process.env.OCULUS_ACCESS_TOKEN)
  throw new Error("env var OCULUS_ACCESS_TOKEN is not set");
else if (!process.env.OCULUS_ORGANIZATION)
  throw new Error("env var OCULUS_ORGANIZATION is not set");

export interface OculusRawData {
  code: string;
  org_scoped_id: string;
}
export interface OculusTokens {
  oauth_token: string;
  refresh_code: string;
}
export interface OculusUser {
  id: string;
  alias: string;
}
export function decodeOculusData(data: string): OculusRawData {
  if (!data) throw new Error("invalid data string");
  const decoded = Buffer.from(data, "base64").toString();
  if (!decoded) throw new Error("invalid base64 string");
  const json = JSON.parse(decoded);
  if (!json?.code) throw new Error("invalid oculus data 1");
  else if (!json.org_scoped_id) throw new Error("invalid oculus data 2");
  return json;
}

export async function getOculusTokens(
  oculusData: OculusRawData
): Promise<OculusTokens> {
  const { code, org_scoped_id } = oculusData;
  const params = new URLSearchParams({
    code: code,
    access_token: process.env.OCULUS_ACCESS_TOKEN,
    org_scoped_id: org_scoped_id,
  });
  const accessRes = await axios.post(
    "https://graph.oculus.com/sso_authorize_code?" + params.toString()
  );
  const oauthData = accessRes.data;
  if (!oauthData.oauth_token) throw new Error("invalid oculus data 1");
  if (!oauthData.refresh_code) throw new Error("invalid oculus data 2");
  return {
    oauth_token: oauthData.oauth_token,
    refresh_code: oauthData.refresh_code,
  };
}

export async function getOculusUser(access_token: string): Promise<OculusUser> {
  const data = await axios.get(
    `https://graph.oculus.com/me?access_token=${access_token}&fields=id,alias`
  );
  return data.data;
}
export function getBaseRedirect() {
  const redirect_uri_base =
    process.env.NODE_ENV === "production"
      ? `https://vrpl-graphql.herokuapp.com`
      : `https://localhost:3001`;
  return redirect_uri_base;
}

export function getOculusAuthUrl() {
  return `https://auth.oculus.com/sso/?redirect_uri=${encodeURIComponent(
    `${getBaseRedirect()}/api/auth/discord/callback`
  )}&organization_id=${process.env.OCULUS_ORGANIZATION}`;
}
