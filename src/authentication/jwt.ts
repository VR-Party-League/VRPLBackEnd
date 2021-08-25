import { NextFunction, RequestHandler, response, request } from "express";
import { getUserFromKey } from "../db/apiKeys";
import { getPlayerFromId } from "../db/player";
import jwt from "jsonwebtoken";
import { VrplPlayer } from "../db/models/vrplPlayer";

export const Authenticate: (
  req: typeof request,
  res: typeof response,
  next: NextFunction
) => Promise<any> = async (req, res, next) => {
  try {
    console.log(".try");
    //console.log(req);
    if (
      req.headers["Authorization"] &&
      typeof req.headers["Authorization"] === "string"
    ) {
      console.log(".header exists");

      if (req.headers["Authorization"].startsWith("Token")) {
        const token = req.headers["Authorization"].substr("Token".length);
        console.log("Api Token:", token);
        const ApiToken = await getUserFromKey(token.trim());
        console.log("Api token data: ", ApiToken);
        if (ApiToken?.playerId) {
          req.user = (await getPlayerFromId(ApiToken.playerId)) || undefined;
        }
      } else if (req.headers["Authorization"].startsWith("Bearer")) {
        const token = req.headers["Authorization"].substr("Bearer".length);
        console.log("Bearer Token:", token);
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
          console.log("Bearer token data: ", decoded);
          if (
            !decoded ||
            typeof decoded === "string" ||
            typeof decoded.sub !== "string"
          ) {
            //return res.status(400).send({ message: "invalid jwt" });
            console.log(
              "92398fdsf9hasdf7yasd8f7yas9fd87yas97dfya897sdfya987dfy"
            );
          } else {
            req.user = (await getPlayerFromId(decoded.sub)) || undefined;
          }
        } catch (err) {
          console.log("Error decoding JWT: ", err);
          //return res.status(403).send({ message: "Error decoding JWT" });
        }
      }
    }
  } catch (err) {
    console.trace();
    console.log(err);
    //res.status(501).send({ message: "Error authenticating" });
  } finally {
    console.log("USER: ", req.user);
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
