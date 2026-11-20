import { Router } from "express";
import {
  getMessages,
  getDirectMessages,
  getConversations,
  getMessageById,
  createMessage,
  updateMessage,
  deleteMessage,
} from "../src/controllers/message.controller";

const router = Router();

router.get("/", getMessages);
router.get("/dm", getDirectMessages); // must be before /:id
router.get("/conversations", getConversations); // must be before /:id
router.get("/:id", getMessageById);
router.post("/", createMessage);
router.put("/:id", updateMessage);
router.delete("/:id", deleteMessage);

export default router;
