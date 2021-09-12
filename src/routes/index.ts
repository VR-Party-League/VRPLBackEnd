import { Router } from "express";
import api from "./api";
const router = Router();
router.use("/api", api);
router.get("/OwO", (req, res) => {
  return res.send({ message: "OwO, what this" });
});
export default router;
