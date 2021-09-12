import { Router } from "express";
import multer, { MulterError } from "multer";
import sharp from "sharp";
import { addCooldown, doesHaveCooldown } from "../../../db/cooldown";
import { getTeamFromId } from "../../../db/team";
import { Permissions, userHasPermission } from "../../../utils/permissions";
import { uploadAvatar } from "../../../utils/storage";
const router = Router();
const upload = multer({ limits: { fileSize: 1024 ** 2 } });

router.post("/user/:id", async (req, res) => {
  upload.single("avatar")(req, res, async function (err) {
    // Check for the player is logged in
    if (!req.user) return res.status(401).send({ message: "Unauthorized" });
    // Check for multer errors
    else if (err && err instanceof MulterError)
      return res.status(400).send({ message: err.code });
    else if (err) throw err;
    // Check if the player is permitted to perform this action
    else if (
      req.params.id !== req.user.id &&
      !userHasPermission(req.user, Permissions.ManagePlayers)
    )
      return res.status(403).send({ message: "Forbidden" });
    // Check if the player is on cooldown
    else if (
      !userHasPermission(req.user, Permissions.ManagePlayers) &&
      doesHaveCooldown("player", req.user.id, "changeAvatar")
    )
      return res.status(429).send({ message: "You are on a cooldown" });

    // Verify file properties
    const file = req.file;
    if (!file) return res.status(400).send({ message: "No file uploaded" });
    else if (file.size > 50 * 1024 * 1024)
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
    await addCooldown("player", req.user.id, "changeAvatar");
    // Upload it to the blob storage
    const uploadRes = await uploadAvatar("player", req.user.id, resizedBuffer);
    if (uploadRes.errorCode) {
      console.error(uploadRes, uploadRes.errorCode);
      return res.status(500).send({ message: uploadRes.errorCode });
    }
    return res.status(201).send({ message: "Success!" });
  });
});

router.post("/tournament/:tournamentID/team/:id", async (req, res) => {
  upload.single("avatar")(req, res, async function (err) {
    // Check for the player is logged in
    if (!req.user) return res.status(401).send({ message: "Unauthorized" });
    // Check for multer errors
    else if (err && err instanceof MulterError)
      return res.status(400).send({ message: err.code });
    else if (err) throw err;
    // Check if the team exists
    const team = await getTeamFromId(req.params.id, req.params.tournamentID);
    if (!team) return res.status(400).send({ message: "Invalid team" });
    // Check if the player is permitted to perform this action
    else if (
      team.ownerId !== req.user.id &&
      !userHasPermission(req.user, Permissions.ManageTeams)
    )
      return res.status(403).send({ message: "Forbidden" });
    // Check if the player is on cooldown
    else if (
      !userHasPermission(req.user, Permissions.ManageTeams) &&
      doesHaveCooldown("team", team.id, "changeAvatar")
    )
      return res.status(429).send({ message: "This team is on a cooldown" });

    // Verify file properties
    const file = req.file;
    if (!file) return res.status(400).send({ message: "No file uploaded" });
    else if (file.size > 50 * 1024 * 1024)
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
    await addCooldown("team", team.id, "changeAvatar");
    // Upload it to the blob storage
    const uploadRes = await uploadAvatar(
      "team",
      team.id,
      resizedBuffer,
      team.tournamentId
    );
    if (uploadRes.errorCode) {
      console.error(uploadRes, uploadRes.errorCode);
      return res.status(500).send({ message: uploadRes.errorCode });
    }
    return res.status(201).send({ message: "Success!" });
  });
});
export default router;
