import { Router } from "express";
import {
  getMessageById,
  updateMessage,
  deleteMessage,
} from "../src/controllers/message.controller";

const router = Router();

router.get("/:messageId/details", getMessageById);
router.put("/:messageId/edit", updateMessage);
router.delete("/:messageId/delete", deleteMessage);

export default router;
