import { NextFunction, RequestHandler, response, request } from "express";
import { getUserFromKey } from "../db/apiKeys";
import { getPlayerFromId } from "../db/player";
import jwt from "jsonwebtoken";
import { VrplPlayer } from "../db/models/vrplPlayer";
import * as Sentry from "@sentry/node";

export const Authenticate: (
  req: typeof request,
  res: typeof response,
  next: NextFunction
) => Promise<any> = async (req, res, next) => {
  try {
    if (
      req.headers["Authorization"] &&
      typeof req.headers["Authorization"] === "string"
    ) {
      if (req.headers["Authorization"].startsWith("Token")) {
        Sentry.addBreadcrumb({
          message: "Authenticating bot",
          category: "log",
          data: {
            header: req.headers["Authorization"],
          },
        });
        const token = req.headers["Authorization"].substr("Token".length);
        const ApiToken = await getUserFromKey(token.trim());
        if (ApiToken?.playerId) {
          req.user = (await getPlayerFromId(ApiToken.playerId)) || undefined;
        }
      } else if (req.headers["Authorization"].startsWith("Bearer")) {
        Sentry.addBreadcrumb({
          message: "Authenticating user",
          category: "log",
          data: {
            header: req.headers["Authorization"],
          },
        });
        const token = req.headers["Authorization"].substr("Bearer".length);
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
          if (
            !decoded ||
            typeof decoded === "string" ||
            typeof decoded.sub !== "string"
          ) {
            //return res.status(400).send({ message: "invalid jwt" });
          } else {
            req.user = (await getPlayerFromId(decoded.sub)) || undefined;
          }
        } catch (err) {
          //return res.status(403).send({ message: "Error decoding JWT" });
        }
      }
    }
  } catch (err) {
    console.trace();
    console.error(err);
    Sentry.captureException(err);
    //res.status(501).send({ message: "Error authenticating" });
  } finally {
    Sentry.addBreadcrumb({
      message: "Authentication complete",
      category: "log",
      data: {
        user: req.user,
      },
    });
    next();
  }
};

export const refreshTokenExpireIn: string = "60d";
export function createRefreshToken(player: VrplPlayer) {
  return jwt.sign(
    { sub: player.id },
    process.env.REFRESH_TOKEN_SECRET as string,
    {
      expiresIn: refreshTokenExpireIn,
    }
  );
}
export const accessTokenExpireIn: string = "30m";
export function createAccessToken(player: VrplPlayer) {
  return jwt.sign(
    { sub: player.id },
    process.env.ACCESS_TOKEN_SECRET as string,
    {
      expiresIn: accessTokenExpireIn,
    }
  );
}
