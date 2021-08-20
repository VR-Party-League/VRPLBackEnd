import { Router } from "express";
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
  updatePlayerDiscordInfo,
} from "../../db/player";
import { createJwtToken } from "../../authentication/jwt";
import ms from "ms";

const router = Router();

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

    res
      .cookie("Authorization", createJwtToken(player), {
        expires: new Date(Date.now() + ms("100d")),
        //httpOnly: true,
        //domain: frontEndDomain + ":3001",
        //sameSite: "none",
        //secure: true,
        //path: "/api",
      })
      .redirect(frontEndUrl);
  } catch (error) {
    // NOTE: An unauthorized token will not throw an error;
    // it will return a 401 Unauthorized response in the try block above
    console.error(error);
    res.status(500).send({ message: "Error" });
  }
});

router.get("/token", async (req, res) => {
  if (!req.user) return res.status(401).send({ msg: "Unauthorized" });
  const user = req.user;
  const apiKey = await newApiToken(user);
  res.status(201).send(apiKey);
});

router.get("/logout", (req, res) => {
  res.clearCookie("Authorization", { domain: frontEndDomain });
  res.redirect(frontEndUrl);
});

router.get("/", (req, res) => {
  if (req.user) {
    res.send(req.user);
  } else {
    res.status(401).send({ msg: "Unauthorized" });
  }
});

export default router;
