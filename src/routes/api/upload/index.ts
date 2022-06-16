import { Router } from "express";
import multer, { MulterError } from "multer";
import sharp from "sharp";
import {
  addCooldownToPlayer,
  addCooldownToTeam,
  getPlayerCooldownExpiresAt,
  getTeamCooldownExpiresAt,
} from "../../../db/cooldown";
import { getTeamFromId } from "../../../db/team";
import { Permissions } from "../../../utils/permissions";
import { uploadAvatar } from "../../../utils/storage";
import { getPlayerFromId } from "../../../db/player";

const router = Router();
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const upload = multer({ limits: { fileSize: MAX_FILE_SIZE } });
router.post("/user/:id", async (req, res) => {
  upload.single("avatar")(req, res, async function (err) {
    try {
      let auth = req.auth;
      // Check for the player is logged in
      if (!auth) return res.status(401).send({ message: "Unauthorized" });
      auth.assureScope("player.avatar:write");

      // Check for multer errors
      if (err && err instanceof MulterError)
        return res.status(400).send({ message: err.code });
      else if (err) throw err;
      let player = await getPlayerFromId(req.params.id);
      // Check if the player is permitted to perform this action
      if (!player) return res.status(404).send({ message: "Player not found" });
      else if (player.id !== auth.playerId)
        auth.assurePerm(Permissions.ManagePlayers);
      // Check if the player is on cooldown
      const cooldown = await getPlayerCooldownExpiresAt(
        player.id,
        "changeAvatar"
      );
      if (cooldown && !auth.hasPerm(Permissions.ManagePlayers)) {
        return res.status(429).send({
          message: `You are on a cooldown until ${cooldown.toString()}`,
        });
      }
      // Verify file properties
      const file = req.file;
      if (!file) return res.status(400).send({ message: "No file uploaded" });
      else if (file.size > MAX_FILE_SIZE)
        return res.status(400).send({ message: "File to big" });

      // Verify image
      let resizedBuffer;
      try {
        resizedBuffer = await sharp(file.buffer)
          .resize(256, 256)
          .png()
          .toBuffer();
      } catch (err) {
        return res.status(400).send({ message: "Invalid image" });
      }
      // Add cooldown
      if (!cooldown) await addCooldownToPlayer(player.id, "changeAvatar");
      // Upload it to the blob storage
      const uploadRes = await uploadAvatar(player, resizedBuffer, auth);
      if (uploadRes && uploadRes.errorCode) {
        console.error(uploadRes, uploadRes.errorCode);
        return res.status(500).send({ message: uploadRes.errorCode });
      }
      return res.status(201).send({ message: "Success!" });
    } catch (err) {
      console.error("Error setting player profile pic", err);
      return res.status(500).send({ message: "Internal Server Error" });
    }
  });
});

router.post("/tournament/:tournamentID/team/:id", (req, res) => {
  upload.single("avatar")(req, res, async function (err) {
    try {
      const auth = req.auth;
      // Check for the player is logged in
      if (!auth) return res.status(401).send({ message: "Unauthorized" });
      auth.assureScope("team.avatar:write");

      // Check for multer errors
      if (err && err instanceof MulterError)
        return res.status(400).send({ message: err.code });
      else if (err) throw err;
      // Check if the team exists
      const team = await getTeamFromId(req.params.tournamentID, req.params.id);
      if (!team) return res.status(400).send({ message: "Invalid team" });
      // Check if the player is permitted to perform this action
      else if (team.ownerId !== auth.playerId)
        auth.assurePerm(Permissions.ManageTeams);
      // Check if the player is on cooldown
      const cooldown = await getTeamCooldownExpiresAt(
        team.id,
        team.tournamentId,
        "changeAvatar"
      );
      if (cooldown && !auth.hasPerm(Permissions.ManageTeams))
        return res.status(429).send({
          message: `This team is on a cooldown until ${cooldown.toString()}`,
        });

      // Verify file properties
      const file = req.file;
      if (!file) return res.status(400).send({ message: "No file uploaded" });
      else if (file.size > MAX_FILE_SIZE)
        return res.status(400).send({ message: "File to big" });

      // Verify image
      let resizedBuffer;
      try {
        resizedBuffer = await sharp(file.buffer)
          .resize(256, 256)
          .png()
          .toBuffer();
      } catch (err) {
        return res.status(400).send({ message: "Invalid image" });
      }
      // Add cooldown
      if (!cooldown)
        await addCooldownToTeam(team.id, team.tournamentId, "changeAvatar");
      // Upload it to the blob storage
      const uploadRes = await uploadAvatar(team, resizedBuffer, auth);
      if (uploadRes && uploadRes.errorCode) {
        console.error(uploadRes, uploadRes.errorCode);
        return res.status(500).send({ message: uploadRes.errorCode });
      }
      return res.status(201).send({ message: "Success!" });
    } catch (err) {
      console.error("Error setting team profile pic", err);
      return res.status(500).send({ message: "Internal Server Error" });
    }
  });
});
export default router;
