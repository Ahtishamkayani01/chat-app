import type { AppDispatch } from "../store";
import type { Message } from "@/types/chat";
import { chatApi } from "./chatApi";

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
      room.lastMessage = { text: msg.text, sender: msg.sender, at: msg.createdAt };
    }),
  );
  // Someone just opened a DM with me that isn't in my sidebar yet: refetch the list.
  if (!roomKnown) dispatch(invalidateTags(["Rooms"]));
}

/** Replace an edited message in its room's history. */
export function cacheReplaceMessage(dispatch: AppDispatch, me: string, msg: Message) {
  dispatch(
    updateQueryData("getRoomMessages", { roomId: msg.room, user: me }, (draft) => {
      const i = draft.findIndex((m) => m._id === msg._id);
      if (i !== -1) draft[i] = msg;
    }),
  );
}

/** Remove a deleted message from its room's history. */
export function cacheRemoveMessage(dispatch: AppDispatch, me: string, roomId: string, id: string) {
  dispatch(
    updateQueryData("getRoomMessages", { roomId, user: me }, (draft) =>
      draft.filter((m) => m._id !== id),
    ),
  );
}

/** Refetch everything (e.g. after a reconnect, in case we missed events). */
export function cacheResync(dispatch: AppDispatch) {
  dispatch(invalidateTags(["Rooms", "Messages"]));
}
