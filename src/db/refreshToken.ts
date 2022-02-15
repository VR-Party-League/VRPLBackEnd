import ms from "ms";
import {
  createAccessToken,
  createRefreshToken,
  refreshTokenExpireIn,
} from "../utils/authentication/jwt";
import RefreshTokenDB, { RefreshToken } from "./models/RefreshToken";
import { VrplPlayer } from "./models/vrplPlayer";
import { Document } from "mongoose";
import { InternalServerError } from "../utils/errors";

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
  await RefreshTokenDB.deleteOne({
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
  const RefreshTokenDocument = await getTokenByRefreshToken(refreshToken);
  if (!RefreshTokenDocument) {
    return { success: false, error: "Refresh token not found" };
  } else if (Date.now() > RefreshTokenDocument.expireAt.getTime()) {
    await RefreshTokenDB.deleteOne({ token: refreshToken });
    return { success: false, error: "Refresh token expired" };
  }
  // else if (RefreshTokenDocument.createdByIp !== ipAddress) {
  //   return { success: false, error: "Ip address changed" };
  // }

  const newRefreshToken = await generateNewRefreshToken(
    player,
    ipAddress,
    refreshToken
  );
  return {
    success: true,
    refreshToken: newRefreshToken.refreshToken,
    accessToken: newRefreshToken.accessToken,
  };
}

export async function generateNewRefreshToken(
  player: VrplPlayer,
  ipAddress: string,
  oldRefreshToken?: string
): Promise<{ refreshToken: string; accessToken: string }> {
  const newRefreshToken = createRefreshToken(player);
  if (!oldRefreshToken)
    await RefreshTokenDB.create({
      token: newRefreshToken,
      expireAt: new Date(Date.now() + ms(refreshTokenExpireIn)),
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: player.id,
      updatedByIp: ipAddress,
      createdByIp: ipAddress,
    });
  else {
    const updateResult = await RefreshTokenDB.updateOne(
      {
        token: oldRefreshToken,
      },
      {
        token: newRefreshToken,
        expireAt: new Date(Date.now() + ms(refreshTokenExpireIn)),
        updatedAt: new Date(),
        updatedByIp: ipAddress,
      }
    ).exec();
    if (updateResult.matchedCount === 0)
      throw new InternalServerError(
        "Could not find refresh token in database when trying to update it"
      );
    else if (updateResult.modifiedCount === 0)
      throw new InternalServerError(
        "Could not modify refresh token in database while trying to update"
      );
  }
  const newAccessToken = createAccessToken(player);
  return {
    refreshToken: newRefreshToken,
    accessToken: newAccessToken,
  };
}
