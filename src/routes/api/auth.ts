import { CookieOptions, Router } from "express";
import { frontEndDomain, frontEndUrl } from "../..";
import {
  getOAuthUrl,
  getRedirectUri,
  getUserFromOAuthData,
} from "../../authentication/discord";
import { newApiToken } from "../../db/apiKeys";
import axios from "axios";
import { APIUser, RESTPostOAuth2AccessTokenResult } from "discord-api-types/v9";
import {
  createPlayerFromDiscordInfo,
  getPlayerFromDiscordId,
  getPlayerFromId,
  updatePlayerDiscordInfo,
} from "../../db/player";
import { accessTokenExpireIn } from "../../authentication/jwt";
import ms from "ms";
import {
  generateNewRefreshToken,
  getAccessToken,
  getTokenByRefreshToken,
} from "../../db/refreshToken";
import jwt from "jsonwebtoken";
const router = Router();

const cookieName = "refresh_token";
const cookieSettings: CookieOptions = {
  expires: new Date(Date.now() + ms("300d")),
  httpOnly: true,
  path: "/api/auth",
  sameSite: "none",
  secure: true,
};

router.get("/discord", (req, res) => {
  res.redirect(getOAuthUrl());
});

router.get("/discord/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send({ message: "No code provided" });
  else if (typeof code !== "string")
    return res.status(400).send({ message: "Code not string" });

  try {
    const oauthResult = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: process.env.CLIENT_ID as string,
        client_secret: process.env.CLIENT_SECRET as string,
        code,
        grant_type: "authorization_code",
        redirect_uri: getRedirectUri(),
        scope: "identify",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const oauthData: RESTPostOAuth2AccessTokenResult = oauthResult.data;
    console.log(oauthData);
    const user = await getUserFromOAuthData(oauthData);
    let player = await getPlayerFromDiscordId(user.id);
    if (player) {
      if (player.discordId !== user.id) {
        return res.status(400).send({
          message:
            "Changing discord accounts is not currently allowed. If you need to switch your account to a new discord account please contact an administrator.",
        });
      } else if (
        player.discordAvatar !== user.avatar ||
        player.discordTag !== user.username + user.discriminator
      ) {
        await updatePlayerDiscordInfo(player, user);
      }
    } else {
      player = await createPlayerFromDiscordInfo(user);
    }
    const data = await generateNewRefreshToken(player, req.ip);
    if (!data.success) throw new Error(data.error);
    res
      .cookie(cookieName, data.refreshToken, cookieSettings)
      .redirect(frontEndUrl);
  } catch (error) {
    // NOTE: An unauthorized token will not throw an error;
    // it will return a 401 Unauthorized response in the try block above
    const time = new Date().toISOString();
    console.log(time);
    console.trace();
    console.error(error);
    res.status(500).send({
      message: `Error, PLEASE contact Fish#2455 if you see this and give him the time`,
      time: time,
    });
  }
});
router.get("/botToken", async (req, res) => {
  if (!req.user) return res.status(401).send({ msg: "Unauthorized" });
  const user = req.user;
  const apiKey = await newApiToken(user);
  res.status(201).send({
    key: apiKey,
    message: `Treat this key with care ${user.discordTag}, anyone that has it can access your whole account!\nWhen you generate a new key by going to this url again, the old key will be deleted.`,
  });
});

router.get("/logout", (req, res) => {
  res.clearCookie(cookieName);
  res.redirect(frontEndUrl);
});

router.get("/", async (req, res) => {
  if (req.user) return res.status(200).send(req.user);
  if (req.cookies[cookieName]) {
    try {
      const decoded = jwt.verify(
        req.cookies[cookieName],
        process.env.REFRESH_TOKEN_SECRET as string
      );

      if (
        !decoded ||
        typeof decoded === "string" ||
        typeof decoded.sub !== "string" ||
        !decoded.exp
      ) {
        return res.status(400).send({ message: "Invalid refresh token" });
      } else if (decoded.exp <= Math.floor(new Date().valueOf() / 1000)) {
        return res.status(400).send({ message: "Refresh token expired" });
      }
      const [token, player] = await Promise.all([
        getTokenByRefreshToken(req.cookies[cookieName]),
        getPlayerFromId(decoded.sub),
      ]);
      if (!token)
        return res.status(500).send({
          message: "Refresh token doesn't exist!? pls send to Fish#2455",
          token: token,
          refreshToken: req.cookies[cookieName],
          player: player,
          decoded: decoded,
        });
      else if (token.userId !== decoded.sub)
        return res.status(500).send({
          message: "Refresh token has invalid user id!? pls send to Fish#2455",
          token: token,
          refreshToken: req.cookies[cookieName],
          player: player,
          decoded: decoded,
        });
      else if (+token.expireAt <= Date.now())
        return res.status(500).send({
          message: "Refresh token expired!? pls send to Fish#2455",
          token: token,
          refreshToken: req.cookies[cookieName],
          player: player,
          decoded: decoded,
        });
      else if (!player)
        return res.status(500).send({
          message: "Not an existing player!? pls send to Fish#2455",
          token: token,
          refreshToken: req.cookies[cookieName],
          player: player,
          decoded: decoded,
        });
      else if (!player.id == token.id)
        return res.status(500).send({
          message: "Invalid player id!? pls send to Fish#2455",
          token: token,
          refreshToken: req.cookies[cookieName],
          player: player,
          decoded: decoded,
        });
      const data = await getAccessToken(
        req.cookies[cookieName],
        player,
        req.ip
      );
      if (!data.success)
        return res.status(500).send({
          message: "Error generating access token!? pls send to Fish#2455",
          error: data.error,
          token: token,
          refreshToken: req.cookies[cookieName],
          player: player,
          decoded: decoded,
        });
      const userData: any = player;
      userData.accessToken = data.accessToken;
      userData.expiresAt = Date.now() + ms(accessTokenExpireIn);
      return res
        .cookie(cookieName, data.refreshToken, cookieSettings)
        .status(201)
        .send(userData);
    } catch (err) {
      console.trace();
      console.error(err);
    }
  }

  res.status(401).send({ message: "Unauthorized" });
});

export default router;
