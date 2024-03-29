// import { CookieOptions, Router } from "express";
// import * as Sentry from "@sentry/node";
// import { frontEndUrl } from "../..";
// import {
//   getOAuthUrl,
//   getDiscordUserFromOAuthData,
// } from "../../utils/authentication/discord";
// import axios from "axios";
// import { RESTPostOAuth2AccessTokenResult } from "discord-api-types/v9";
// import {
//   createPlayerFromDiscordInfo,
//   getPlayerFromDiscordId,
//   updatePlayerDiscordInfo,
// } from "../../db/player";
// import { refreshTokenExpireIn } from "../../utils/authentication/jwt";
// import ms from "ms";
// import {
//   generateNewRefreshToken,
//   revokeTokenByRefreshToken,
// } from "../../db/refreshToken";
// import { URLSearchParams } from "url";
// import {
//   decodeOculusData,
//   getBaseRedirect,
//   getOculusAuthUrl,
//   getOculusTokens,
//   getOculusUser,
//   OculusRawData,
//   OculusTokens,
//   OculusUser,
// } from "../../utils/authentication/oculus";
// import { getUserFromPlayerId } from "../../db/user";
// import { InternalServerError } from "../../utils/errors";
//
// const router = Router();
//
// const cookieName = "refresh_token";
// const cookieSettings: CookieOptions = {
//   expires: new Date(Date.now() + ms(refreshTokenExpireIn)),
//   httpOnly: true,
//   path: "/api/auth",
//   sameSite: "none",
//   secure: true,
// };
//
// router.get("/discord", (req, res) => {
//   const serverUrl = req.protocol + "://" + req.get("host");
//   res.redirect(getOAuthUrl(serverUrl));
// });
//
// router.get("/discord/callback", async (req, res) => {
//   const code = req.query.code;
//   const serverUrl = req.protocol + "://" + req.get("host");
//   if (!code) return res.status(400).send({ message: "No code provided" });
//   else if (typeof code !== "string")
//     return res.status(400).send({ message: "Code not string" });
//
//   try {
//     const oauthResult = await axios.post(
//       "https://discord.com/api/oauth2/token",
//       new URLSearchParams({
//         client_id: process.env.CLIENT_ID as string,
//         client_secret: process.env.CLIENT_SECRET as string,
//         code,
//         grant_type: "authorization_code",
//         redirect_uri: `${serverUrl}/api/auth/discord/callback`,
//         scope: "identify",
//       }),
//       {
//         headers: {
//           "Content-Type": "application/x-www-form-urlencoded",
//         },
//       }
//     );
//
//     const oauthData: RESTPostOAuth2AccessTokenResult = oauthResult.data;
//     const user = await getDiscordUserFromOAuthData(oauthData);
//     let player = await getPlayerFromDiscordId(user.id);
//
//     if (player) {
//       if (player.discordId !== user.id) {
//         return res.status(400).send({
//           message:
//             "Changing discord accounts is not currently allowed. If you need to switch your account to a new discord account please contact an administrator.",
//         });
//       } else if (
//         player.discordAvatar !== user.avatar ||
//         player.discordTag !== `${user.username}#${user.discriminator}`
//       ) {
//         const vrplUser = await getUserFromPlayerId(player.id);
//         if (!vrplUser) throw new InternalServerError("User not found!!!");
//         await updatePlayerDiscordInfo(player, user, vrplUser._id);
//       }
//     } else {
//       player = await createPlayerFromDiscordInfo(user);
//     }
//     const data = await generateNewRefreshToken(player, req.ip);
//     res
//       .cookie(cookieName, data.refreshToken, cookieSettings)
//       .redirect(frontEndUrl);
//   } catch (error) {
//     // NOTE: An unauthorized token will not throw an error;
//     // it will return a 401 Unauthorized response in the try block above
//     const time = new Date().toISOString();
//     console.error(time);
//     console.trace();
//     console.error(error);
//     Sentry.captureException(error);
//     res.status(500).send({
//       message: `Error, PLEASE contact Fish#2455 if you see this and give him the time! Love you!`,
//       time: time,
//     });
//   }
// });
// // router.post("/botToken", async (req, res) => {
// //   if (!req.user) return res.status(401).send({ message: "Unauthorized" });
// //   const user = req.user;
// //   const apiKey = await newApiToken(user);
// //   res.status(201).send({
// //     key: apiKey,
// //     message: `Treat this key with care, ${user.nickname}, anyone that has it can access your whole account!
// // When you generate a new key this one key will be deactivated.
// // To use it set the 'Authorization' header to 'Token ${apiKey.apiToken}' on any request.`,
// //   });
// // });
//
// router.get("/logout", async (req, res) => {
//   const cookie = req.cookies[cookieName];
//   if (cookie) {
//     await revokeTokenByRefreshToken(cookie);
//   }
//   res.cookie(cookieName, "how_to_delete_cookie_pls_help", cookieSettings);
//
//   res.status(200);
//   res.send({ message: "Cleared cookie!" });
// });
//
// router.get("/oculus", async (req, res) => {
//   res.redirect(getOculusAuthUrl());
// });
//
// router.get("/oculus/callback", async (req, res) => {
//   res.status(200).send(`
// <h1 id="waiting">Please wait a sec, <3</h1>
// <script>
// const hash = window.location.hash;
// if(!hash) {
//   const el = document.getElementById("waiting");
//   el.innerHTML = "Oi, ur url be wackadoodle! if u didn't do anything weird then u should ping make support ticket!";
//
// }else{
// window.location.replace("${getBaseRedirect()}/api/auth/oculus/callback/"+hash.substring(1));
// const el = document.getElementById("waiting");
// el.innerHTML = '<a href=\"${getBaseRedirect()}/api/auth/oculus/callback/'+hash.substring(1)+'">Click here if redirect not working within like 4 seconds </a>';
// }</script>
// `);
// });
//
// router.get("/oculus/callback/:data", async (req, res) => {
//   let data: OculusRawData;
//   try {
//     data = decodeOculusData(req.params.data);
//   } catch (err) {
//     return res.status(400).send({ message: "Error parsing oauth data" });
//   }
//   // decode data as base64 string and then json format it
//
//   let tokenData: OculusTokens;
//   try {
//     tokenData = await getOculusTokens(data);
//   } catch (err) {
//     return res.status(400).send({ message: "Error fetching oculus token" });
//   }
//   let user: OculusUser;
//   try {
//     user = await getOculusUser(tokenData.oauth_token);
//   } catch (err) {
//     return res.status(400).send({ message: "Error fetching oculus user" });
//   }
//   res.status(200).send({
//     user,
//     tokenData,
//   });
// });
// // router.get("/", async (req, res) => {
// //   if (req.user) return res.status(200).send(req.user);
// //   if (req.cookies[cookieName]) {
// //     try {
// //       const decoded = jwt.verify(
// //         req.cookies[cookieName],
// //         process.env.REFRESH_TOKEN_SECRET as string
// //       );
// //
// //       if (
// //         !decoded ||
// //         typeof decoded === "string" ||
// //         typeof decoded.sub !== "string" ||
// //         !decoded.exp
// //       ) {
// //         return res.status(400).send({ message: "Invalid refresh token" });
// //       } else if (decoded.exp <= Math.floor(new Date().valueOf() / 1000)) {
// //         return res.status(400).send({ message: "Refresh token expired" });
// //       }
// //       const [token, player] = await Promise.all([
// //         getTokenByRefreshToken(req.cookies[cookieName]),
// //         getPlayerFromId(decoded.sub),
// //       ]);
// //       if (!token)
// //         return res
// //           .status(400)
// //           .send({ message: "Invalid or expired refresh token" });
// //       else if (token.userId !== decoded.sub)
// //         return res.status(500).send({
// //           message: "Refresh token has invalid user id!? pls send to Fish#2455",
// //           token: token,
// //           refreshToken: req.cookies[cookieName],
// //           player: player,
// //           decoded: decoded,
// //         });
// //       else if (+token.expireAt <= Date.now())
// //         return res.status(500).send({
// //           message: "Refresh token expired!? pls send to Fish#2455",
// //           token: token,
// //           refreshToken: req.cookies[cookieName],
// //           player: player,
// //           decoded: decoded,
// //         });
// //       else if (!player)
// //         return res.status(500).send({
// //           message: "Not an existing player!? pls send to Fish#2455",
// //           token: token,
// //           refreshToken: req.cookies[cookieName],
// //           player: player,
// //           decoded: decoded,
// //         });
// //       else if (!player.id == token.id)
// //         return res.status(500).send({
// //           message: "Invalid player id!? pls send to Fish#2455",
// //           token: token,
// //           refreshToken: req.cookies[cookieName],
// //           player: player,
// //           decoded: decoded,
// //         });
// //       const data = await getAccessToken(
// //         req.cookies[cookieName],
// //         player,
// //         req.ip
// //       );
// //       if (!data.success)
// //         return res.status(500).send({
// //           message: "Error generating access token!? pls send to Fish#2455",
// //           error: data.error,
// //           token: token,
// //           refreshToken: req.cookies[cookieName],
// //           player: player,
// //           decoded: decoded,
// //         });
// //       const userData: any = player.toObject();
// //       userData.accessToken = data.accessToken;
// //       userData.expiresAt = Date.now() + ms(accessTokenExpireIn);
// //       return res
// //         .cookie(cookieName, data.refreshToken, cookieSettings)
// //         .status(201)
// //         .send(userData);
// //     } catch (err) {
// //       if (!(err instanceof JsonWebTokenError)) {
// //         console.trace();
// //         console.error(err);
// //         Sentry.captureException(err);
// //         throw err;
// //       }
// //     }
// //   }
// //
// //   res.status(401).send({ message: "Unauthorized" });
// // });
// export default router;
