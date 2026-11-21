import { Router } from "express";
import { getUser } from "../src/controllers/user.controller";
import { requireAuth } from "../src/middleware/auth.middleware";

const router = Router();
router.use(requireAuth);
router.get("/:username", getUser);

export default router;
