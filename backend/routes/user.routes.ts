import { Router } from "express";
import { getUser } from "../src/controllers/user.controller";

const router = Router();

router.get("/:username", getUser);

export default router;
