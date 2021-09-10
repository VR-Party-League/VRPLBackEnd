import { Router } from "express";
import multer from "multer";
import avatar from "./avatar";
const router = Router();

router.use("/user", avatar);
//router.use("/team", team);
export default router;
