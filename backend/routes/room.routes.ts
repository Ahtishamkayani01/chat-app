import { Router } from "express";
import {
  getMyRooms,
  openDirectRoom,
  listRoomMessages,
  postRoomMessage,
} from "../src/controllers/room.controller";
import { requireAuth } from "../src/middleware/auth.middleware";

const router = Router();
router.use(requireAuth);
router.get("/my-rooms", getMyRooms); // sidebar list
router.post("/direct/open", openDirectRoom); // open/create a DM
router.get("/:roomId/messages/history", listRoomMessages); // chat history
router.post("/:roomId/messages/send", postRoomMessage); // send a message

export default router;
