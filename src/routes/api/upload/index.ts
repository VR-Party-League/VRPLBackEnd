import { Router } from "express";
import multer, { MulterError } from "multer";
import sharp from "sharp";
import {
  addCooldownToPlayer,
  addCooldownToTeam,
  doesHaveCooldown,
} from "../../../db/cooldown";
import { getTeamFromId } from "../../../db/team";
import { Permissions, userHasPermission } from "../../../utils/permissions";
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
      // Check for multer errors
      else if (err && err instanceof MulterError)
        return res.status(400).send({ message: err.code });
      else if (err) throw err;
      let player = await getPlayerFromId(req.params.id);
      // Check if the player is permitted to perform this action
      if (!player) return res.status(404).send({ message: "Player not found" });
      else if (
        player.id !== auth.playerId &&
        !userHasPermission(auth, Permissions.ManagePlayers)
      )
        return res.status(403).send({ message: "Forbidden" });
      // Check if the player is on cooldown
      else if (
        !userHasPermission(auth, Permissions.ManagePlayers) &&
        (await doesHaveCooldown("player", player.id, "changeAvatar"))
      ) {
        return res.status(429).send({ message: "You are on a cooldown" });
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
      await addCooldownToPlayer(player.id, "changeAvatar");
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
      // Check for multer errors
      else if (err && err instanceof MulterError)
        return res.status(400).send({ message: err.code });
      else if (err) throw err;
      // Check if the team exists
      const team = await getTeamFromId(req.params.tournamentID, req.params.id);
      if (!team) return res.status(400).send({ message: "Invalid team" });
      // Check if the player is permitted to perform this action
      else if (
        team.ownerId !== auth.playerId &&
        !userHasPermission(auth, Permissions.ManageTeams)
      )
        return res.status(403).send({ message: "Forbidden" });
      // Check if the player is on cooldown
      else if (
        !userHasPermission(auth, Permissions.ManageTeams) &&
        (await doesHaveCooldown("team", team.id, "changeAvatar"))
      )
        return res.status(429).send({ message: "This team is on a cooldown" });

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
