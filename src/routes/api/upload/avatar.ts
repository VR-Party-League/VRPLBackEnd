import { Router } from "express";
import multer, { MulterError } from "multer";
import { uploadAvatar } from "../../../utils/storage/player";
import sharp from "sharp";
const router = Router();
const upload = multer({ limits: { fileSize: 1024 ** 2 } });

router.post("/", async (req, res) => {
  upload.single("avatar")(req, res, async function (err) {
    if (!req.user) return res.status(401).send({ message: "Unauthorized" });
    else if (err) {
      if (err instanceof MulterError) {
        if (err.code === "LIMIT_FILE_SIZE")
          res.status(413).send({ message: "The file is to big" });
        else {
          console.error(err);
          console.error(err.code);
          res.status(400).send({ message: err.code });
        }
        return;
      }
    }
    const file = req.file;
    if (!file) return res.status(400).send({ message: "No file uploaded" });
    else if (file.size > 50 * 1024 * 1024)
      return res.status(400).send({ message: "File to big" });
    const buffer = file.buffer;
    let resizedBuffer;
    try {
      resizedBuffer = await sharp(buffer).resize(256, 256).png().toBuffer();
    } catch (err) {
      console.error(err);
      return res.status(400).send("Invalid image");
    }
    const uploadRes = await uploadAvatar(req.user.id, resizedBuffer);
  });
});
export default router;
// TODO: Do cooldowns on changing avatar
