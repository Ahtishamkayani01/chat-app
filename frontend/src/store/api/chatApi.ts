import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import type { Message, Room } from "@/types/chat";
import { API_BASE_URL } from "@/config/env";
import { expireSession, getSession, type Session } from "@/lib/auth";

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL, // one base URL for every API call
  // Runs before every request: attach "Authorization: Bearer <token>"
  prepareHeaders: (headers) => {
    const token = getSession()?.token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

// If the server says our token is missing/expired (401), log out, except on the
// sign-in / register calls themselves, where 401 just means "wrong password".
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extra,
) => {
  const result = await rawBaseQuery(args, api, extra);
  const url = typeof args === "string" ? args : args.url;
  if (result.error?.status === 401 && !url.startsWith("auth/")) expireSession();
  return result;
};

// NOTE: the backend now reads "who am I" from the token. Some endpoints still take
// `user` as an argument, but only so RTK Query keeps a separate cache per user;
// it is NOT sent to the server.
export const chatApi = createApi({
  reducerPath: "chatApi",
  baseQuery,
  tagTypes: ["Rooms", "Messages"],
  endpoints: (build) => ({
    // ---------- Auth ----------

    // POST /auth/register  → { token, username }
    register: build.mutation<Session, { username: string; email: string; password: string }>({
      query: (body) => ({ url: "auth/register", method: "POST", body }),
    }),

    // POST /auth/login  (identifier = username or email)  → { token, username }
    login: build.mutation<Session, { identifier: string; password: string }>({
      query: (body) => ({ url: "auth/login", method: "POST", body }),
    }),

    // ---------- Users ----------

    // GET /users/:username  → 404 if the user doesn't exist
    getUser: build.query<{ username: string }, string>({
      query: (username) => `users/${encodeURIComponent(username)}`,
    }),

    // ---------- Rooms ----------

    // GET /rooms/my-rooms  → [globalRoom, ...rooms I'm a member of]
    // (arg = my username, used only as the cache key)
    getMyRooms: build.query<Room[], string>({
      query: () => "rooms/my-rooms",
      providesTags: ["Rooms"],
    }),

    // POST /rooms/direct/open  → existing or newly created DM room
    openDirectRoom: build.mutation<Room, { user: string; with: string }>({
      query: ({ with: other }) => ({ url: "rooms/direct/open", method: "POST", body: { with: other } }),
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

    // GET /rooms/:roomId/messages/history  (user = cache key only)
    getRoomMessages: build.query<Message[], { roomId: string; user: string }>({
      query: ({ roomId }) => `rooms/${roomId}/messages/history`,
      providesTags: (_res, _err, { roomId }) => [{ type: "Messages", id: roomId }],
    }),

    // POST /rooms/:roomId/messages/send
    // (REST alternative; the UI sends over the socket so others get it in real time)
    sendRoomMessage: build.mutation<Message, { roomId: string; text: string }>({
      query: ({ roomId, text }) => ({
        url: `rooms/${roomId}/messages/send`,
        method: "POST",
        body: { text },
      }),
      invalidatesTags: (_res, _err, { roomId }) => [{ type: "Messages", id: roomId }, "Rooms"],
    }),

    // ---------- Messages ----------

    // GET /messages/:messageId/details
    getMessageDetails: build.query<Message, string>({
      query: (messageId) => `messages/${messageId}/details`,
    }),

    // PUT /messages/:messageId/edit  (only the author)
    editMessage: build.mutation<Message, { messageId: string; text: string }>({
      query: ({ messageId, text }) => ({
        url: `messages/${messageId}/edit`,
        method: "PUT",
        body: { text },
      }),
      invalidatesTags: (res) => (res ? [{ type: "Messages", id: res.room }] : []),
    }),

    // DELETE /messages/:messageId/delete  (only the author)
    deleteMessage: build.mutation<
      { message: string },
      { messageId: string; roomId: string }
    >({
      query: ({ messageId }) => ({
        url: `messages/${messageId}/delete`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, { roomId }) => [{ type: "Messages", id: roomId }],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
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
