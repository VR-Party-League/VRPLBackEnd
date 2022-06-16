import express, { Router } from "express";
import oauth from "../../utils/servers/createOAuthServer";
import { Request, Response } from "oauth2-server";
import { getPlayerFromUserId } from "../../db/player";
import {
  ForbiddenError,
  InternalServerError,
  UnauthorizedError,
} from "../../utils/errors";
import {
  AllOAuthScopes,
  OAuthClient,
  OAuthScopes,
  OauthToken,
} from "../../db/models/OAuthModels";
import { Permissions, userHasPermission } from "../../utils/permissions";
import { getUserFromApiToken } from "../../db/apiKeys";
import { captureException } from "@sentry/node";

const router = Router();

router.all("/token", (req, res, next) => {
  oauth
    .token(new Request(req), new Response(res), {
      // extendedGrantTypes: {
      //   discord: new DiscordGrantType({}),
      // },
    })
    .then(function (token) {
      let newToken = {
        access_token: token.accessToken,
        refresh_token: token.refreshToken,
        expires_in: token.accessTokenExpiresAt
          ? Math.floor(
              (token.accessTokenExpiresAt?.getTime() - Date.now()) / 1000
            )
          : undefined,
        scope:
          typeof token.scope === "string"
            ? token.scope
            : token.scope?.join(" "),
        token_type: token.tokenType,
        refresh_token_expires_in: token.refreshTokenExpiresAt
          ? Math.floor(
              (token.refreshTokenExpiresAt?.getTime() - Date.now()) / 1000
            )
          : undefined,
      };
      res.json(newToken);
    })
    .catch(function (err) {
      console.error("Error in token endpoint", err);
      res.status(err.code || 500).send({ message: err });
    });
});

export const authenticate: (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => any = async (req, res, next) => {
  if (!req.headers.authorization) return next();
  else if (req.headers.authorization.startsWith("Token ")) {
    try {
      const token = req.headers.authorization.slice("Token ".length);
      const user = await getUserFromApiToken(token);
      if (!user) return next(new UnauthorizedError("Invalid API token"));
      req.auth = {
        userId: user._id,
        playerId: user.playerId,
        permissions: user.permissions,
        scope: [...OAuthScopes],
        getPlayer: async () => {
          const player = await getPlayerFromUserId(user._id);
          if (!player)
            throw new InternalServerError("User does not have a linked player");
          return player;
        },
        hasPerm: function (perm: Permissions) {
          const has = userHasPermission(user, perm);
          if (has) {
            if (!this) throw new UnauthorizedError();
            this.assureScope("USE_PERMISSIONS");
          }
          return has;
        },
        assurePerm: function (perm: Permissions) {
          if (!userHasPermission(user, perm)) throw new ForbiddenError();
          else if (!this?.scope?.includes("USE_PERMISSIONS"))
            throw new ForbiddenError(
              "Insufficient scope. Missing: USE_PERMISSIONS"
            );
          // TODO: make @authorized go away
          // TODO: let everythin need USE_PERMISSIONS if it uses permissions, easy way is to make check here
        },
        assureScope: function (scope: AllOAuthScopes) {
          if (!this?.scope?.includes(scope))
            throw new ForbiddenError(`Insufficient scope. Missing: ${scope}`);
        },
      };
    } catch (e) {
      captureException(e);
      return next(new UnauthorizedError("Invalid API token"));
    } finally {
      return next();
    }
  } else {
    try {
      const token = (await oauth.authenticate(
        new Request(req),
        new Response(res)
      )) as OauthToken;
      // console.log("[auth] token:", token);
      const user = token.user;
      const client = token.client as OAuthClient;
      const scope = token.scope;
      req.auth = {
        userId: token.user._id,
        playerId: user.playerId,
        permissions: user.permissions,
        scope: (typeof scope === "string"
          ? scope.split(" ")
          : scope) as AllOAuthScopes[],
        getPlayer: async () => {
          const player = await getPlayerFromUserId(user._id);
          if (!player)
            throw new InternalServerError("User does not have a linked player");
          return player;
        },
        hasPerm: function (perm: Permissions) {
          const has = userHasPermission(user, perm);
          if (has) {
            this.assureScope("USE_PERMISSIONS");
          }
          return has;
        },
        assurePerm: function (perm: Permissions) {
          if (!userHasPermission(user, perm)) throw new ForbiddenError();
          else if (!this.scope?.includes("USE_PERMISSIONS"))
            throw new ForbiddenError(
              "Insufficient scope. Missing: USE_PERMISSIONS"
            );
          // TODO: make @authorized go away
          // TODO: let everythin need USE_PERMISSIONS if it uses permissions, easy way is to make check here
        },
        assureScope: function (scope: AllOAuthScopes) {
          if (!this?.scope?.includes(scope))
            throw new ForbiddenError(`Insufficient scope. Missing: ${scope}`);
        },
        client: {
          clientId: client.clientId,
          clientName: client.clientName,
          createdAt: client.createdAt,
          verified: client.verified,
          userId: client.userId,
        },
      };
    } catch (err) {
      // const error = err as UnauthorizedRequestError;
      // console.error("[auth] failed", error.message);
      captureException(err);
      // res.status(err.code || 500).send({ message: err });
    } finally {
      return next();
    }
  }
};

router.post("/authorize", authenticate, (req, res, next) => {
  oauth
    .authorize(new Request(req), new Response(res))
    .then(function (token) {
      console.log("[authorize] token", token);
      res.json(token);
    })
    .catch(function (err) {
      console.log("[authorize] err", err);
      res.status(err.code || 500).send({ message: err });
    });
});
// router.use("/api/oauth", (res, req) => {});
router.get("/secure", authenticate, (req, res) => {
  res.json({ message: "owwhwhwhwh secure!" });
});
export default router;
