import { Router } from "express";
import {
  getMyRooms,
  openDirectRoom,
  listRoomMessages,
  postRoomMessage,
  createGroupRoom,
  addMembers,
  removeMember,
  leaveRoom,
  renameRoom,
} from "../src/controllers/room.controller";
import { requireAuth } from "../src/middleware/auth.middleware";

const router = Router();
router.use(requireAuth);
router.get("/my-rooms", getMyRooms); // sidebar list
router.post("/direct/open", openDirectRoom); // open/create a DM
router.get("/:roomId/messages/history", listRoomMessages); // chat history
router.post("/:roomId/messages/send", postRoomMessage); // send a message
router.post("/group/create", createGroupRoom); // create a group (creator = admin)
router.post("/:roomId/members/add", addMembers); // admin: add people
router.post("/:roomId/members/remove", removeMember); // admin: remove someone
router.post("/:roomId/leave", leaveRoom); // leave a group (messages stay)
router.put("/:roomId/rename", renameRoom); // admin: rename

export default router;
