import type { AppDispatch } from "../store";
import type { Message, Room } from "@/types/chat";
import { chatApi } from "./chatApi";
import { messagePreview } from "@/lib/attachments";

// Helpers that patch the RTK Query cache when socket events arrive,
// so the UI updates in real time without refetching.

const { updateQueryData, invalidateTags } = chatApi.util;

/** Add a new message to its room's history and update the sidebar preview. */
export function cacheAddMessage(dispatch: AppDispatch, me: string, msg: Message) {
  dispatch(
    updateQueryData("getRoomMessages", { roomId: msg.room, user: me }, (draft) => {
      if (!draft.some((m) => m._id === msg._id)) draft.push(msg);
    }),
  );

  let roomKnown = false;
  dispatch(
    updateQueryData("getMyRooms", me, (draft) => {
      const room = draft.find((r) => r._id === msg.room);
      if (!room) return;
      roomKnown = true;
      room.lastMessage = { ...messagePreview(msg), sender: msg.sender, at: msg.createdAt };
    }),
  );
  // Someone just opened a DM with me that isn't in my sidebar yet: refetch the list.
  if (!roomKnown) dispatch(invalidateTags(["Rooms"]));
}

/** Replace an edited message in its room's history (+ sidebar preview if it's the newest). */
export function cacheReplaceMessage(dispatch: AppDispatch, me: string, msg: Message) {
  dispatch(
    updateQueryData("getRoomMessages", { roomId: msg.room, user: me }, (draft) => {
      const i = draft.findIndex((m) => m._id === msg._id);
      if (i !== -1) draft[i] = msg;
    }),
  );
  dispatch(
    updateQueryData("getMyRooms", me, (draft) => {
      const room = draft.find((r) => r._id === msg.room);
      if (room?.lastMessage && room.lastMessage.at === msg.createdAt) {
        Object.assign(room.lastMessage, messagePreview(msg));
      }
    }),
  );
}

/**
 * Remove a deleted message from its room's history, and update the sidebar
 * preview with the server's recomputed lastMessage (null = room is now empty).
 */
export function cacheRemoveMessage(
  dispatch: AppDispatch,
  me: string,
  roomId: string,
  id: string,
  lastMessage?: Room["lastMessage"] | null,
) {
  dispatch(
    updateQueryData("getRoomMessages", { roomId, user: me }, (draft) =>
      draft.filter((m) => m._id !== id),
    ),
  );
  if (lastMessage === undefined) return; // older server: no preview info sent
  dispatch(
    updateQueryData("getMyRooms", me, (draft) => {
      const room = draft.find((r) => r._id === roomId);
      if (room) room.lastMessage = lastMessage ?? undefined;
    }),
  );
}

/** Refetch everything (e.g. after a reconnect, in case we missed events). */
export function cacheResync(dispatch: AppDispatch) {
  dispatch(invalidateTags(["Rooms", "Messages"]));
}

/** Add a room to the sidebar, or replace it if it's already there (rename, members changed). */
export function cacheUpsertRoom(dispatch: AppDispatch, me: string, room: Room) {
  dispatch(
    updateQueryData("getMyRooms", me, (draft) => {
      const i = draft.findIndex((r) => r._id === room._id);
      if (i === -1) draft.push(room);
      else draft[i] = room;
    }),
  );
}

/** Remove a room from the sidebar (I left, or an admin removed me). */
export function cacheRemoveRoom(dispatch: AppDispatch, me: string, roomId: string) {
  dispatch(updateQueryData("getMyRooms", me, (draft) => draft.filter((r) => r._id !== roomId)));
}
