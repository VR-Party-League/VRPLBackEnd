import { NextFunction, RequestHandler, response, request } from "express";
import { getUserFromKey } from "../../db/apiKeys";
import { getPlayerFromId } from "../../db/player";
import jwt from "jsonwebtoken";
import { VrplPlayer } from "../../db/models/vrplPlayer";
import * as Sentry from "@sentry/node";

export const Authenticate: (
  req: typeof request,
  res: typeof response,
  next: NextFunction
) => Promise<any> = async (req, res, next) => {
  try {
    if (
      req.headers["authorization"] &&
      typeof req.headers["authorization"] === "string"
    ) {
      if (req.headers["authorization"].startsWith("Token")) {
        Sentry.addBreadcrumb({
          message: "Authenticating bot",
          category: "log",
          data: {
            header: req.headers["authorization"],
          },
        });
        const token = req.headers["authorization"].substr("Token ".length);
        const ApiToken = await getUserFromKey(token.trim());
        if (ApiToken?.playerId) {
          req.user = (await getPlayerFromId(ApiToken.playerId)) || undefined;
        }
      } else if (req.headers["authorization"].startsWith("Bearer")) {
        Sentry.addBreadcrumb({
          message: "Authenticating user",
          category: "log",
          data: {
            header: req.headers["authorization"],
          },
        });
        const token = req.headers["authorization"].substr("Bearer ".length);
        try {
          const decoded = jwt.verify(
            token,
            process.env.ACCESS_TOKEN_SECRET as string
          );
          if (
            !decoded ||
            typeof decoded !== "object" ||
            typeof decoded.sub !== "string"
          ) {
            //return res.status(400).send({ message: "invalid jwt" });
          } else {
            req.user = (await getPlayerFromId(decoded.sub)) || undefined;
          }
        } catch (err) {
          console.log(err);
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
