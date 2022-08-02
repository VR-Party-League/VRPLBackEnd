import { Router } from "express";
import api from "./api";
import { BadRequestError } from "../utils/errors";

const router = Router();
router.use("/api", api);
router.get("/OwO", (req, res) => {
  return res.send({ message: "OwO, what this", auth: req.auth });
});
export default router;
