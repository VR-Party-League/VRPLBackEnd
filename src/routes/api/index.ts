import { Router } from "express";
// import auth from "./auth";
import upload from "./upload";
import oauth2 from "./oauth2";

const router = Router();

// router.use("/auth", auth);
router.use("/upload", upload);
router.use("/oauth2", oauth2);
router.use("/teapot", (req, res) => {
  res.status(418).send(`<img src="https://http.cat/418"/>`);
});

export default router;
