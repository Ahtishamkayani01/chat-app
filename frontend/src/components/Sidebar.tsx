"use client";

import { FormEvent, useState } from "react";
import type { AttachmentKind, Room } from "@/types/chat";
import { formatShort } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { byLatestActivity, roomTitle } from "@/lib/rooms";
import { normalizePreview } from "@/lib/attachments";
import { Avatar, GlobalAvatar, GroupAvatar } from "./Avatar";
import KindIcon from "./KindIcon";
import NewGroupDialog from "./NewGroupDialog";

// Each file kind gets its own soft color in the sidebar preview
const KIND_COLOR: Record<AttachmentKind, string> = {
  image: "text-stone-400",
  video: "text-stone-400",
  audio: "text-stone-400",
  document: "text-stone-400",
  archive: "text-stone-400",
};

/** "You: [icon] Photo" / "ali: Hello" (groups) / "[icon] Voice message" */
function LastMessagePreview({
  last,
  me,
  showSender,
}: {
  last: NonNullable<Room["lastMessage"]>;
  me: string;
  /** Groups: show who sent it, since there are many people */
  showSender: boolean;
}) {
  const { text, kind } = normalizePreview(last);
  const who = last.sender === me ? "You" : showSender ? last.sender : null;
  return (
    <span className="flex min-w-0 items-center gap-1">
      {who && <span className="shrink-0">{who}:</span>}
      {kind && (
        <KindIcon kind={kind} voice={text === "Voice message"} className={`h-4 w-4 ${KIND_COLOR[kind]}`} />
      )}
      <span className="truncate">{text}</span>
    </span>
  );
}

type Props = {
  username: string;
  rooms: Room[]; // from GET /rooms/my-rooms (global + mine)
  activeRoomId: string | null;
  unread: Record<string, number>; // keyed by roomId
  connected: boolean;
  onSelectRoom: (roomId: string) => void;
  onStartDm: (username: string) => Promise<void>; // throws if the user doesn't exist
  onCreateGroup: (name: string, members: string[]) => Promise<void>; // throws on failure
  onLogout: () => void;
  className?: string;
};

function UnreadBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full gloss-accent bg-accent-600 px-1.5 text-[11px] font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function Sidebar({
  username,
  rooms,
  activeRoomId,
  unread,
  connected,
  onSelectRoom,
  onStartDm,
  onCreateGroup,
  onLogout,
  className = "",
}: Props) {
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false); // "+" menu: new chat / new group
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatError, setNewChatError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const globalRoom = rooms.find((r) => r.type === "global");
  const privateRooms = rooms.filter((r) => r.type !== "global").sort(byLatestActivity);

  const term = search.trim().toLowerCase();
  const filtered = term
    ? privateRooms.filter((r) => roomTitle(r, username).toLowerCase().includes(term))
    : privateRooms;
  const groups = filtered.filter((r) => r.type === "group");
  const directs = filtered.filter((r) => r.type === "direct");

  function renderRoom(room: Room) {
    const isGroup = room.type === "group";
    const title = roomTitle(room, username);
    const last = room.lastMessage;
    const preview = last ? (
      <LastMessagePreview last={last} me={username} showSender={isGroup} />
    ) : isGroup ? (
      `${room.members.length} members`
    ) : (
      "No messages yet"
    );
    return (
      <ChatRow
        key={room._id}
        active={activeRoomId === room._id}
        onClick={() => onSelectRoom(room._id)}
        avatar={isGroup ? <GroupAvatar name={title} /> : <Avatar name={title} />}
        title={title}
        subtitle={preview}
        time={last ? formatShort(last.at) : undefined}
        unread={unread[room._id]}
      />
    );
  }

  async function startChat(e: FormEvent) {
    e.preventDefault();
    const name = newChatName.trim().toLowerCase();
    if (!name || checking) return;
    if (name === username) return setNewChatError("That's you!");

    // The backend checks the user exists, then opens (or creates) the DM room
    setChecking(true);
    try {
      await onStartDm(name);
    } catch (err) {
      setNewChatError(getErrorMessage(err, "Could not start chat"));
      return;
    } finally {
      setChecking(false);
    }

    setNewChatName("");
    setNewChatError(null);
    setNewChatOpen(false);
  }

  return (
    <aside className={`flex flex-col border-r border-stone-200 bg-white ${className}`}>
      {/* Profile header */}
      <header className="flex items-center gap-3 border-b border-stone-100 px-4 py-3">
        <div className="relative">
          <Avatar name={username} />
          <span
            className={`absolute right-0 bottom-0 h-3 w-3 rounded-full ring-2 ring-white ${connected ? "bg-emerald-500" : "bg-amber-400"}`}
            title={connected ? "Online" : "Connecting…"}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-stone-800">{username}</p>
          <p className="text-xs text-stone-500">{connected ? "Online" : "Connecting…"}</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            title="New chat or group"
            className={`rounded-md p-2 transition ${menuOpen || newChatOpen ? "bg-stone-100 text-stone-900" : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className={`h-5 w-5 transition ${menuOpen ? "rotate-45" : ""}`}
            >
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>

          {menuOpen && (
            <>
              {/* click-away layer */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-11 right-0 z-20 w-56 origin-top-right animate-[pop_140ms_ease-out] overflow-hidden rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-stone-200">
                <MenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    setNewChatOpen(true);
                  }}
                  icon={
                    <path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
                  }
                  title="New chat"
                  hint="Message one person"
                />
                <MenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    setNewChatOpen(false);
                    setGroupDialogOpen(true);
                  }}
                  icon={
                    <>
                      <circle cx="9" cy="8" r="3.2" />
                      <path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.2a3 3 0 0 1 0 5.6M18 14.3c1.8.7 3 2.4 3 5" strokeLinecap="round" />
                    </>
                  }
                  title="New group"
                  hint="Chat with several people"
                />
              </div>
            </>
          )}
        </div>
        <button
          onClick={onLogout}
          title="Leave"
          className="rounded-md p-2 text-stone-700 transition hover:bg-red-50 hover:text-red-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </header>

      {/* New chat */}
      {newChatOpen && (
        <form onSubmit={startChat} className="border-b border-stone-200 bg-stone-50 px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-stone-500">Start a private chat</label>
            <button
              type="button"
              onClick={() => {
                setNewChatOpen(false);
                setNewChatError(null);
              }}
              className="text-xs font-medium text-stone-400 hover:text-stone-600"
            >
              Cancel
            </button>
          </div>
          <div className="flex gap-2">
            <input
              autoFocus
              value={newChatName}
              onChange={(e) => {
                setNewChatName(e.target.value);
                setNewChatError(null);
              }}
              placeholder="Their username"
              maxLength={30}
              className={`min-w-0 flex-1 rounded-lg border bg-white px-3 py-1.5 text-sm text-stone-800 outline-none focus:ring-2 ${
                newChatError
                  ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                  : "border-stone-200 focus:border-accent-400 focus:ring-accent-100"
              }`}
            />
            <button
              type="submit"
              disabled={!newChatName.trim() || checking}
              className="rounded-lg gloss-accent bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
            >
              {checking ? "Checking…" : "Chat"}
            </button>
          </div>
          {newChatError && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
              {newChatError}
            </p>
          )}
        </form>
      )}

      {/* Search */}
      <div className="px-4 py-2.5">
        <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-stone-400 focus-within:border-stone-300 focus-within:bg-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="w-full bg-transparent text-sm text-stone-800 outline-none placeholder:text-stone-400"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto pb-2">
        {/* Global chat, always pinned on top */}
        {globalRoom && (!term || "global chat".includes(term)) && (
          <ChatRow
            active={activeRoomId === globalRoom._id}
            onClick={() => onSelectRoom(globalRoom._id)}
            avatar={<GlobalAvatar />}
            title="Global chat"
            subtitle="Everyone in the room"
            unread={unread[globalRoom._id]}
          />
        )}

        {groups.length > 0 && (
          <>
            <SectionTitle
              title="Groups"
              action={
                <button
                  onClick={() => setGroupDialogOpen(true)}
                  className="rounded px-1.5 py-0.5 text-xs font-medium text-accent-700 hover:bg-accent-50"
                >
                  + New
                </button>
              }
            />
            {groups.map(renderRoom)}
          </>
        )}

        <SectionTitle title="Direct messages" />
        {directs.length === 0 && (
          <p className="px-4 py-4 text-center text-sm leading-relaxed text-stone-400">
            {term ? "No chats found." : "No private chats yet. Tap a name in the global chat, or use + to start one."}
          </p>
        )}
        {directs.map(renderRoom)}

        {!term && groups.length === 0 && (
          <button
            onClick={() => setGroupDialogOpen(true)}
            className="mx-4 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-lg border border-dashed border-stone-300 px-4 py-3 text-left transition hover:border-stone-400 hover:bg-stone-50"
          >
            <GroupAvatar name="New group" size="sm" />
            <span>
              <span className="block text-sm font-medium text-stone-800">Create a group</span>
              <span className="block text-xs text-stone-500">Chat with friends or your team</span>
            </span>
          </button>
        )}
      </nav>

      {groupDialogOpen && (
        <NewGroupDialog me={username} onClose={() => setGroupDialogOpen(false)} onCreate={onCreateGroup} />
      )}
    </aside>
  );
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-1">
      <p className="text-xs font-semibold text-stone-500">{title}</p>
      {action}
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  title,
  hint,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition hover:bg-stone-100"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-4.5 w-4.5">
          {icon}
        </svg>
      </span>
      <span>
        <span className="block text-sm font-semibold text-stone-800">{title}</span>
        <span className="block text-xs text-stone-500">{hint}</span>
      </span>
    </button>
  );
}

function ChatRow({
  active,
  onClick,
  avatar,
  title,
  subtitle,
  time,
  unread,
}: {
  active: boolean;
  onClick: () => void;
  avatar: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
  time?: string;
  unread?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
        active ? "bg-accent-50" : "hover:bg-stone-50"
      }`}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`truncate font-medium ${active ? "text-accent-800" : "text-stone-800"}`}>{title}</p>
          {time && <span className={`shrink-0 text-[11px] ${unread ? "font-semibold text-accent-600" : "text-stone-400"}`}>{time}</span>}
        </div>
        <div className="flex items-center justify-between">
          <div className={`min-w-0 truncate text-sm ${unread ? "font-medium text-stone-700" : "text-stone-500"}`}>
            {subtitle}
          </div>
          <UnreadBadge count={unread} />
        </div>
      </div>
    </button>
  );
}
