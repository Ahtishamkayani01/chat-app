import { Router } from "express";
import {
  getMessageById,
  updateMessage,
  deleteMessage,
} from "../src/controllers/message.controller";
import { requireAuth } from "../src/middleware/auth.middleware";

const router = Router();
router.use(requireAuth);

router.get("/:messageId/details", getMessageById);
router.put("/:messageId/edit", updateMessage);
router.delete("/:messageId/delete", deleteMessage);

export default router;
