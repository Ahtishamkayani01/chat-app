import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Message, Room } from "@/types/chat";
import { API_BASE_URL } from "@/config/env";

export const chatApi = createApi({
  reducerPath: "chatApi",
  baseQuery: fetchBaseQuery({ baseUrl: API_BASE_URL }), // one base URL for every API call
  tagTypes: ["Rooms", "Messages"],
  endpoints: (build) => ({
    // ---------- Users ----------

    // GET /users/:username  → 404 if the user doesn't exist
    getUser: build.query<{ username: string }, string>({
      query: (username) => `users/${encodeURIComponent(username)}`,
    }),

    // ---------- Rooms ----------

    // GET /rooms/my-rooms?user=  → [globalRoom, ...rooms I'm a member of]
    getMyRooms: build.query<Room[], string>({
      query: (user) => ({ url: "rooms/my-rooms", params: { user } }),
      providesTags: ["Rooms"],
    }),

    // POST /rooms/direct/open  → existing or newly created DM room
    openDirectRoom: build.mutation<Room, { user: string; with: string }>({
      query: (body) => ({ url: "rooms/direct/open", method: "POST", body }),
      // Put the room straight into the sidebar cache, so it shows instantly.
      async onQueryStarted({ user }, { dispatch, queryFulfilled }) {
        try {
          const { data: room } = await queryFulfilled;
          dispatch(
            chatApi.util.updateQueryData("getMyRooms", user, (draft) => {
              if (!draft.some((r) => r._id === room._id)) draft.push(room);
            }),
          );
        } catch {
          /* error is handled by the caller via .unwrap() */
        }
      },
    }),

    // GET /rooms/:roomId/messages/history?user=
    getRoomMessages: build.query<Message[], { roomId: string; user: string }>({
      query: ({ roomId, user }) => ({
        url: `rooms/${roomId}/messages/history`,
        params: { user },
      }),
      providesTags: (_res, _err, { roomId }) => [{ type: "Messages", id: roomId }],
    }),

    // POST /rooms/:roomId/messages/send
    // (REST alternative; the UI sends over the socket so others get it in real time)
    sendRoomMessage: build.mutation<Message, { roomId: string; sender: string; text: string }>({
      query: ({ roomId, ...body }) => ({
        url: `rooms/${roomId}/messages/send`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, { roomId }) => [{ type: "Messages", id: roomId }, "Rooms"],
    }),

    // ---------- Messages ----------

    // GET /messages/:messageId/details
    getMessageDetails: build.query<Message, string>({
      query: (messageId) => `messages/${messageId}/details`,
    }),

    // PUT /messages/:messageId/edit  (only the author)
    editMessage: build.mutation<Message, { messageId: string; sender: string; text: string }>({
      query: ({ messageId, ...body }) => ({
        url: `messages/${messageId}/edit`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (res) => (res ? [{ type: "Messages", id: res.room }] : []),
    }),

    // DELETE /messages/:messageId/delete  (only the author)
    deleteMessage: build.mutation<
      { message: string },
      { messageId: string; sender: string; roomId: string }
    >({
      query: ({ messageId, sender }) => ({
        url: `messages/${messageId}/delete`,
        method: "DELETE",
        body: { sender },
      }),
      invalidatesTags: (_res, _err, { roomId }) => [{ type: "Messages", id: roomId }],
    }),
  }),
});

export const {
  useGetUserQuery,
  useLazyGetUserQuery,
  useGetMyRoomsQuery,
  useOpenDirectRoomMutation,
  useGetRoomMessagesQuery,
  useSendRoomMessageMutation,
  useGetMessageDetailsQuery,
  useEditMessageMutation,
  useDeleteMessageMutation,
} = chatApi;
