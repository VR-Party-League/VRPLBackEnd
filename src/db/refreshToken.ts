import ms from "ms";
import {
  createAccessToken,
  createRefreshToken,
  refreshTokenExpireIn,
} from "../utils/authentication/jwt";
import RefreshTokenDB, { RefreshToken } from "./models/RefreshToken";
import { VrplPlayer } from "./models/vrplPlayer";
import { Document } from "mongoose";

export async function getTokenByRefreshToken(
  refreshToken: string
): Promise<(RefreshToken & Document<any, any, any>) | null> {
  const doc = await RefreshTokenDB.findOne({
    token: refreshToken,
  });
  return doc;
}

export async function revokeTokenByRefreshToken(
  refreshToken: string
): Promise<void> {
  await RefreshTokenDB.remove({
    token: refreshToken,
  });
}

export async function revokeAllTokensFromUser(userId: string) {
  const res = await RefreshTokenDB.deleteMany({
    userId: userId,
  });
  return res;
}

export async function getAccessToken(
  refreshToken: string,
  player: VrplPlayer,
  ipAddress: string
): Promise<
  | { success: false; error: string }
  | { success: true; refreshToken: string; accessToken: string }
> {
  const doc = await getTokenByRefreshToken(refreshToken);
  if (!doc) {
    return { success: false, error: "Refresh token not found" };
  } else if (+doc.expireAt < Date.now()) {
    await RefreshTokenDB.deleteOne({ token: refreshToken });
    return { success: false, error: "Refresh token expired" };
  } else if (doc.createdByIp !== ipAddress) {
    return { success: false, error: "Ip address changed" };
  }

  const newRefreshToken = createRefreshToken(player);

  const newToken = await RefreshTokenDB.findOneAndUpdate(
    {
      token: refreshToken,
    },
    {
      token: newRefreshToken,
      expireAt: new Date(Date.now() + ms(refreshTokenExpireIn)),
      updatedAt: new Date(),
      userId: player.id,
      updatedByIp: ipAddress,
    }
  );
  if (!newToken)
    throw new Error("No result after updating refresh token in database");
  const newAccessToken = createAccessToken(player);
  return {
    success: true,
    refreshToken: newRefreshToken,
    accessToken: newAccessToken,
  };
}

export async function generateNewRefreshToken(
  player: VrplPlayer,
  ipAddress: string
): Promise<
  | { success: false; error: string }
  | { success: true; refreshToken: string; accessToken: string }
> {
  const newRefreshToken = createRefreshToken(player);
  const newToken = await RefreshTokenDB.create({
    token: newRefreshToken,
    expireAt: new Date(Date.now() + ms(refreshTokenExpireIn)),
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: player.id,
    updatedByIp: ipAddress,
    createdByIp: ipAddress,
  });
  const newAccessToken = createAccessToken(player);
  return {
    success: true,
    refreshToken: newToken.token,
    accessToken: newAccessToken,
  };
}
