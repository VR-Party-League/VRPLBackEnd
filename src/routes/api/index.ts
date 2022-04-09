import { Router } from "express";
import auth from "./auth";
import upload from "./upload";

const router = Router();

router.use("/auth", auth);
router.use("/upload", upload);

router.use("/teapot", (req, res) => {
  res.status(418).send(`<img src="https://http.cat/418"/>`);
});

export default router;
