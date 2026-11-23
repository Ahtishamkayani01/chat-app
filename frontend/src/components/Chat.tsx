"use client";

import { useEffect, useRef, useState } from "react";
import type { Attachment, Message, Room } from "@/types/chat";

type DeletedEvent = { id: string; roomId: string; lastMessage?: Room["lastMessage"] | null };
import { socket, emitAsync } from "@/lib/socket";
import { formatDay, isSameDay } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { groupSubtitle, roomTitle } from "@/lib/rooms";
import { clearSession, expireSession, getSession, saveSession, SESSION_EXPIRED_EVENT, type Session } from "@/lib/auth";
import { useAppDispatch } from "@/store/hooks";
import {
  chatApi,
  useGetMyRoomsQuery,
  useGetRoomMessagesQuery,
  useOpenDirectRoomMutation,
  useUploadAttachmentMutation,
  useCreateGroupMutation,
  useAddGroupMembersMutation,
  useRemoveGroupMemberMutation,
  useLeaveGroupMutation,
  useRenameGroupMutation,
} from "@/store/api/chatApi";
import {
  cacheAddMessage,
  cacheRemoveMessage,
  cacheRemoveRoom,
  cacheReplaceMessage,
  cacheResync,
  cacheUpsertRoom,
} from "@/store/api/chatCache";
import { Avatar, GlobalAvatar, GroupAvatar } from "./Avatar";
import GroupInfoPanel from "./GroupInfoPanel";
import MessageItem from "./MessageItem";
import Composer from "./Composer";
import Sidebar from "./Sidebar";
import AuthScreen from "./AuthScreen";

const NO_MESSAGES: Message[] = [];

/** Usernames are stored lowercase on the backend. */
const normalize = (name: string) => name.trim().toLowerCase();

// ---------- component ----------

export default function Chat() {
  const dispatch = useAppDispatch();

  const [username, setUsername] = useState<string | null>(null);
  const [checkedSession, setCheckedSession] = useState(false); // avoid flashing the sign-in screen

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null); // null = global
  const activeRoomIdRef = useRef<string | null>(null); // read inside socket listeners
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false); // group info panel
  const [unread, setUnread] = useState<Record<string, number>>({}); // keyed by roomId

  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false); // true once connected AND joined

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  // Restore the saved session after mount (localStorage is browser-only).
  useEffect(() => {
    const saved = getSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setUsername(normalize(saved.username));
    setCheckedSession(true);
  }, []);

  // ---------- server data (RTK Query) ----------

  const { data: rooms = [], error: roomsError } = useGetMyRoomsQuery(username ?? "", {
    skip: !username,
  });
  const globalRoom = rooms.find((r) => r.type === "global");
  const activeRoomId = selectedRoomId ?? globalRoom?._id ?? null;
  const activeRoom = rooms.find((r) => r._id === activeRoomId);

  const {
    currentData: history,
    isFetching,
    error: historyError,
  } = useGetRoomMessagesQuery(
    { roomId: activeRoomId ?? "", user: username ?? "" },
    { skip: !username || !activeRoomId },
  );
  const messages = history ?? NO_MESSAGES;
  const loading = !history && (isFetching || !activeRoomId) && !roomsError;

  const [openDirectRoom] = useOpenDirectRoomMutation();
  const [uploadAttachment] = useUploadAttachmentMutation();
  const [createGroup] = useCreateGroupMutation();
  const [addGroupMembers] = useAddGroupMembersMutation();
  const [removeGroupMember] = useRemoveGroupMemberMutation();
  const [leaveGroup] = useLeaveGroupMutation();
  const [renameGroup] = useRenameGroupMutation();

  const fetchError = roomsError ?? historyError;
  const shownError = error ?? (fetchError ? getErrorMessage(fetchError, "Failed to load") : null);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  // ---------- real-time connection ----------

  useEffect(() => {
    if (!username) return;
    const me = username;

    async function onConnect() {
      try {
        await emitAsync("user:join", {}); // server knows who I am from the token
        setConnected(true);
        cacheResync(dispatch); // re-sync in case we missed messages while offline
      } catch (err) {
        setError(getErrorMessage(err, "Failed to join"));
      }
    }
    function onDisconnect() {
      setConnected(false);
    }
    // The server refused the connection (see io.use on the backend).
    function onConnectError(err: Error) {
      if (/token|logged in/i.test(err.message)) expireSession();
    }

    function onNew(msg: Message) {
      cacheAddMessage(dispatch, me, msg);
      if (msg.room !== activeRoomIdRef.current && msg.sender !== me) {
        setUnread((prev) => ({ ...prev, [msg.room]: (prev[msg.room] || 0) + 1 }));
      }
    }

    function onUpdated(msg: Message) {
      cacheReplaceMessage(dispatch, me, msg);
    }

    function onDeleted({ id, roomId, lastMessage }: DeletedEvent) {
      cacheRemoveMessage(dispatch, me, roomId, id, lastMessage);
    }

    // Groups: I was added / something changed (name, members) / I'm no longer in it
    function onRoomUpsert(room: Room) {
      cacheUpsertRoom(dispatch, me, room);
    }
    function onRoomRemoved({ roomId }: { roomId: string }) {
      cacheRemoveRoom(dispatch, me, roomId);
      // Looking at that group right now (e.g. an admin removed me): back to global
      if (activeRoomIdRef.current === roomId) {
        activeRoomIdRef.current = null;
        setSelectedRoomId(null);
        setMobileShowChat(false);
        setInfoOpen(false);
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("message:new", onNew);
    socket.on("message:updated", onUpdated);
    socket.on("message:deleted", onDeleted);
    socket.on("room:new", onRoomUpsert);
    socket.on("room:updated", onRoomUpsert);
    socket.on("room:removed", onRoomRemoved);
    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("message:new", onNew);
      socket.off("message:updated", onUpdated);
      socket.off("message:deleted", onDeleted);
      socket.off("room:new", onRoomUpsert);
      socket.off("room:updated", onRoomUpsert);
      socket.off("room:removed", onRoomRemoved);
      socket.disconnect();
      setConnected(false);
    };
  }, [username, dispatch]);

  // Token rejected by the API or socket: drop back to the sign-in screen.
  useEffect(() => {
    const onExpired = () => {
      handleLogout();
      setError(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  });

  // Scroll to bottom when messages are added; jump instantly when switching rooms.
  useEffect(() => {
    if (messages.length > lastCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: lastCount.current === 0 ? "auto" : "smooth" });
    }
    lastCount.current = messages.length;
  }, [messages]);

  // ---------- actions ----------

  function selectRoom(roomId: string) {
    setMobileShowChat(true);
    setInfoOpen(false);
    setUnread((prev) => ({ ...prev, [roomId]: 0 }));
    if (roomId === activeRoomId) return;
    activeRoomIdRef.current = roomId;
    setSelectedRoomId(roomId);
    lastCount.current = 0;
  }

  /** Open (or create) a DM with `other` and switch to it. Throws on failure. */
  async function startDm(other: string) {
    if (!username) return;
    const room = await openDirectRoom({ user: username, with: normalize(other) }).unwrap();
    selectRoom(room._id);
  }

  async function openDmFromMessage(other: string) {
    try {
      await startDm(other);
    } catch (err) {
      setError(getErrorMessage(err, "Could not open chat"));
    }
  }

  // ---------- groups ----------
  // Each one throws on failure so the dialog / panel can show the error.
  // The response updates this tab right away; socket events update other tabs and members.

  async function handleCreateGroup(name: string, members: string[]) {
    if (!username) return;
    const room = await createGroup({ name, members }).unwrap();
    cacheUpsertRoom(dispatch, username, room);
    selectRoom(room._id);
  }

  async function handleAddMembers(usernames: string[]) {
    if (!username || !activeRoomId) return;
    const room = await addGroupMembers({ roomId: activeRoomId, usernames }).unwrap();
    cacheUpsertRoom(dispatch, username, room);
  }

  async function handleRemoveMember(member: string) {
    if (!username || !activeRoomId) return;
    const room = await removeGroupMember({ roomId: activeRoomId, username: member }).unwrap();
    cacheUpsertRoom(dispatch, username, room);
  }

  async function handleRenameGroup(name: string) {
    if (!username || !activeRoomId) return;
    const room = await renameGroup({ roomId: activeRoomId, name }).unwrap();
    cacheUpsertRoom(dispatch, username, room);
  }

  async function handleLeaveGroup() {
    if (!username || !activeRoomId) return;
    const roomId = activeRoomId;
    await leaveGroup(roomId).unwrap();
    setInfoOpen(false);
    activeRoomIdRef.current = null;
    setSelectedRoomId(null); // back to the global chat
    setMobileShowChat(false);
    cacheRemoveRoom(dispatch, username, roomId);
  }

  function handleAuthed(session: Session) {
    saveSession(session);
    setError(null);
    setUsername(normalize(session.username));
  }

  function handleLogout() {
    clearSession();
    setUsername(null);
    setUnread({});
    activeRoomIdRef.current = null;
    setSelectedRoomId(null);
    setMobileShowChat(false);
    dispatch(chatApi.util.resetApiState()); // drop the previous user's cached data
  }

  /**
   * Send a message. With a file it's 2 steps:
   * 1. upload it to Cloudinary (POST /uploads/attachment) → Attachment info
   * 2. send { roomId, text, attachment } over the socket → everyone in the room gets it live
   */
  async function handleSend(value: string, file?: File) {
    if (!username || !activeRoomId) return false;
    const roomId = activeRoomId; // keep the room even if the user switches while uploading
    try {
      let attachment: Attachment | undefined;
      if (file) attachment = await uploadAttachment(file).unwrap();
      const msg = await emitAsync<Message>("message:send", { roomId, text: value, attachment });
      cacheAddMessage(dispatch, username, msg);
      setError(null);
      return true;
    } catch (err) {
      setError(getErrorMessage(err, file ? "Failed to send file" : "Failed to send"));
      return false;
    }
  }

  async function handleEdit(id: string, value: string) {
    if (!username) return false;
    try {
      const updated = await emitAsync<Message>("message:edit", { id, text: value });
      cacheReplaceMessage(dispatch, username, updated);
      return true;
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update"));
      return false;
    }
  }

  async function handleDelete(id: string) {
    if (!username) return;
    try {
      const { roomId, lastMessage } = await emitAsync<DeletedEvent>("message:delete", { id });
      cacheRemoveMessage(dispatch, username, roomId, id, lastMessage);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete"));
    }
  }

  // ---------- sign-in / register ----------

  if (!checkedSession) return <main className="flex-1 bg-slate-950" />;
  if (!username) return <AuthScreen onAuthed={handleAuthed} />;

  // ---------- main layout ----------

  const isGlobal = !activeRoom || activeRoom.type === "global";
  const isGroup = activeRoom?.type === "group";
  const title = activeRoom ? roomTitle(activeRoom, username) : "Global chat";
  const roomAvatar = isGlobal ? <GlobalAvatar /> : isGroup ? <GroupAvatar name={title} /> : <Avatar name={title} />;
  const subtitle = isGlobal
    ? "Everyone · tap a name to message privately"
    : isGroup && activeRoom
      ? groupSubtitle(activeRoom, username)
      : "🔒 Private chat · only you two can see this";

  return (
    <main className="flex flex-1 bg-slate-200 lg:p-5">
      <div className="mx-auto flex h-dvh w-full max-w-6xl overflow-hidden bg-white shadow-xl lg:h-[calc(100dvh-2.5rem)] lg:rounded-2xl">
        <Sidebar
          username={username}
          rooms={rooms}
          activeRoomId={activeRoomId}
          unread={unread}
          connected={connected}
          onSelectRoom={selectRoom}
          onStartDm={startDm}
          onCreateGroup={handleCreateGroup}
          onLogout={handleLogout}
          className={`w-full md:w-80 md:shrink-0 lg:w-96 ${mobileShowChat ? "hidden md:flex" : "flex"}`}
        />

        <section className={`min-w-0 flex-1 flex-col ${mobileShowChat ? "flex" : "hidden md:flex"}`}>
          {/* Chat header */}
          <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <button
              onClick={() => setMobileShowChat(false)}
              className="-ml-1 rounded-full p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
              title="Back"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {/* In a group, the avatar + title open the group info panel */}
            <button
              type="button"
              onClick={() => isGroup && setInfoOpen(true)}
              disabled={!isGroup}
              className={`-my-1 flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 pr-2 text-left ${
                isGroup ? "transition hover:bg-slate-50" : "cursor-default"
              }`}
            >
              {roomAvatar}
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold text-slate-800">{title}</h2>
                <p className="truncate text-xs text-slate-500">{subtitle}</p>
              </div>
            </button>
            {isGroup && (
              <button
                onClick={() => setInfoOpen(true)}
                title="Group info"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </header>

          {!connected && (
            <div className="bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-700">
              Connecting…
            </div>
          )}
          {shownError && (
            <div className="flex items-center justify-between bg-red-50 px-4 py-1.5 text-xs text-red-700">
              <span>{shownError}</span>
              <button onClick={() => setError(null)} className="font-semibold hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="chat-bg flex-1 overflow-y-auto px-3 py-4 sm:px-6">
            {loading && (
              <div className="flex justify-center pt-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              </div>
            )}

            {!loading && messages.length === 0 && (
              <div className="mx-auto mt-16 max-w-xs rounded-2xl bg-white/80 p-6 text-center shadow-sm backdrop-blur">
                <div className="mb-3 flex justify-center">{roomAvatar}</div>
                <p className="font-medium text-slate-700">
                  {isGlobal ? "No messages yet" : isGroup ? `Welcome to ${title}` : `Start chatting with ${title}`}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {isGlobal
                    ? "Be the first to say hi!"
                    : isGroup
                      ? `${activeRoom?.members.length ?? 0} members · send the first message`
                      : "Messages here are only visible to you two."}
                </p>
                {isGroup && (
                  <button
                    onClick={() => setInfoOpen(true)}
                    className="mt-3 rounded-full bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100"
                  >
                    View members
                  </button>
                )}
              </div>
            )}

            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const newDay = !prev || !isSameDay(prev.createdAt, m.createdAt);
              const showSender = newDay || prev.sender !== m.sender;
              return (
                <div key={m._id}>
                  {newDay && (
                    <div className="my-4 flex justify-center">
                      <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm">
                        {formatDay(m.createdAt)}
                      </span>
                    </div>
                  )}
                  <MessageItem
                    message={m}
                    mine={m.sender === username}
                    showSender={showSender}
                    showNames={isGlobal || isGroup}
                    onOpenDm={(name) => void openDmFromMessage(name)}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <Composer
            key={activeRoomId ?? "none"}
            placeholder={isGlobal ? "Message everyone…" : `Message ${title}…`}
            disabled={!connected || !activeRoomId}
            onSend={handleSend}
            onError={setError}
          />
        </section>
      </div>

      {infoOpen && isGroup && activeRoom && (
        <GroupInfoPanel
          room={activeRoom}
          me={username}
          onClose={() => setInfoOpen(false)}
          onAddMembers={handleAddMembers}
          onRemoveMember={handleRemoveMember}
          onRename={handleRenameGroup}
          onLeave={handleLeaveGroup}
          onMessage={(name) => void openDmFromMessage(name)}
        />
      )}
    </main>
  );
}
