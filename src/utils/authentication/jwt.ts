import { getPlayerFromId } from "../../db/player";
import jwt from "jsonwebtoken";
import { VrplPlayer } from "../../db/models/vrplPlayer";
import { Socket } from "socket.io/dist/socket";
import { ExtendedError } from "socket.io/dist/namespace";
import { Permissions, userHasPermission } from "../permissions";
import crypto from "crypto";
import { getUserFromApiToken } from "../../db/apiKeys";

// export const Authenticate: (
//   req: typeof request,
//   res: typeof response,
//   next: NextFunction
// ) => Promise<any> = async (req, res, next) => {
//   try {
//     if (
//       req.headers["authorization"] &&
//       typeof req.headers["authorization"] === "string"
//     ) {
//       if (req.headers["authorization"].startsWith("Token")) {
//         Sentry.addBreadcrumb({
//           message: "Authenticating with token",
//           category: "log",
//           data: {
//             header: req.headers["authorization"],
//           },
//         });
//         const token = req.headers["authorization"].substr("Token ".length);
//         const ApiToken = await getUserFromKey(token.trim());
//         if (ApiToken?.playerId) {
//           req.user = (await getPlayerFromId(ApiToken.playerId)) || undefined;
//         }
//       } else if (req.headers["authorization"].startsWith("Bearer")) {
//         Sentry.addBreadcrumb({
//           message: "Authenticating user",
//           category: "log",
//           data: {
//             header: req.headers["authorization"],
//           },
//         });
//         const token = req.headers["authorization"]
//           .substr("Bearer ".length)
//           .trim();
//         try {
//           const decoded = jwt.verify(
//             token,
//             process.env.ACCESS_TOKEN_SECRET as string
//           );
//           if (
//             !decoded ||
//             typeof decoded !== "object" ||
//             typeof decoded.sub !== "string"
//           ) {
//             //return res.status(400).send({ message: "invalid jwt" });
//           } else {
//             req.user = (await getPlayerFromId(decoded.sub)) || undefined;
//           }
//         } catch (err) {
//           console.error(err);
//           //return res.status(403).send({ message: "Error decoding JWT" });
//         }
//       }
//     }
//   } catch (err) {
//     console.trace();
//     console.error(err);
//     Sentry.captureException(err);
//     //res.status(501).send({ message: "Error authenticating" });
//   } finally {
//     Sentry.addBreadcrumb({
//       message: "Authentication complete",
//       category: "log",
//       data: {
//         auth: req.auth,
//       },
//     });
//     next();
//   }
// };

export const AuthenticateSocketIO: (
  socket: Socket,
  next: (err?: ExtendedError) => void
) => void = async (socket, next) => {
  try {
    const token = socket.handshake.headers["authorization"];
    if (!token || !token.startsWith("Token "))
      return next(new Error("No token provided"));
    const ApiTokenString = token.substring("Token ".length);
    const user = await getUserFromApiToken(ApiTokenString.trim());
    if (!user) return next(new Error("Invalid token"));
    else if (!userHasPermission(user, Permissions.Server))
      return next(new Error("User does not have permission"));
    return next();
  } catch (err) {
    return next(err as Error);
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

export const accessTokenExpireIn: string = "60m";

export function createAccessToken(player: VrplPlayer) {
  return jwt.sign(
    { sub: player.id },
    process.env.ACCESS_TOKEN_SECRET as string,
    {
      expiresIn: accessTokenExpireIn,
    }
  );
}

type JWTAccessTokenData = {
  sub?: string;
  iss: string;
  perms: number;
  scope: string[];
};

export function generateAccessToken(opts: {
  playerId?: string;
  clientId: string;
  permissions: number;
  scope: string[];
  expiresInSecs: number;
}): string {
  const res = jwt.sign(
    {
      sub: opts.playerId,
      iss: opts.clientId,
      perms: opts.permissions,
      scope: opts.scope,
    } as JWTAccessTokenData,
    process.env.ACCESS_TOKEN_SECRET as string,
    {
      expiresIn: opts.expiresInSecs,
    }
  );
  // console.log("Generated access token", res);
  return res;
}

export function generateRefreshToken() {
  return crypto.randomBytes(255).toString("base64");
}
