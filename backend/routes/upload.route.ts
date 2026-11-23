import { Router } from "express";
import { requireAuth } from "../src/middleware/auth.middleware";
import { handleUpload } from "../src/middleware/upload.middleware";
import { postAttachment } from "../src/controllers/upload.controller";

const router = Router();
router.use(requireAuth); // check the token BEFORE reading the file
router.post("/attachment", handleUpload, postAttachment);
export default router;
