"use client";

import { FormEvent, useState } from "react";
import { api, type Conversation } from "@/lib/api";
import { formatShort } from "@/lib/format";
import { Avatar, GlobalAvatar } from "./Avatar";

export const GLOBAL_KEY = "#global";

type Props = {
  username: string;
  conversations: Conversation[];
  activeChat: string | null;
  unread: Record<string, number>;
  connected: boolean;
  onSelect: (chat: string | null) => void;
  onLogout: () => void;
  className?: string;
};

function UnreadBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function Sidebar({
  username,
  conversations,
  activeChat,
  unread,
  connected,
  onSelect,
  onLogout,
  className = "",
}: Props) {
  const [search, setSearch] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatError, setNewChatError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // If I opened a DM with someone new (no messages yet), still show it in the list.
  const list =
    activeChat && !conversations.some((c) => c.with === activeChat)
      ? [{ with: activeChat, lastMessage: null }, ...conversations]
      : conversations;

  const term = search.trim().toLowerCase();
  const filtered = term ? list.filter((c) => c.with.toLowerCase().includes(term)) : list;

  async function startChat(e: FormEvent) {
    e.preventDefault();
    const name = newChatName.trim();
    if (!name || checking) return;
    if (name === username) return setNewChatError("That's you!");

    // Ask the backend if this user exists before opening a chat
    setChecking(true);
    try {
      await api.getUser(name);
    } catch (err) {
      setNewChatError(err instanceof Error ? err.message : "Could not check user");
      return;
    } finally {
      setChecking(false);
    }

    onSelect(name);
    setNewChatName("");
    setNewChatError(null);
    setNewChatOpen(false);
  }

  return (
    <aside className={`flex flex-col border-r border-slate-200 bg-white ${className}`}>
      {/* Profile header */}
      <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <div className="relative">
          <Avatar name={username} />
          <span
            className={`absolute right-0 bottom-0 h-3 w-3 rounded-full ring-2 ring-white ${connected ? "bg-emerald-500" : "bg-amber-400"}`}
            title={connected ? "Online" : "Connecting…"}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-800">{username}</p>
          <p className="text-xs text-slate-400">{connected ? "Online" : "Connecting…"}</p>
        </div>
        <button
          onClick={() => setNewChatOpen((v) => !v)}
          title="New chat"
          className={`rounded-full p-2 transition ${newChatOpen ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-100"}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={onLogout}
          title="Leave"
          className="rounded-full p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </header>

      {/* New chat */}
      {newChatOpen && (
        <form onSubmit={startChat} className="border-b border-slate-100 bg-indigo-50/50 px-4 py-3">
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Start a private chat</label>
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
              className={`min-w-0 flex-1 rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:ring-2 ${
                newChatError
                  ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                  : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
              }`}
            />
            <button
              type="submit"
              disabled={!newChatName.trim() || checking}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
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
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-slate-400 focus-within:ring-2 focus-within:ring-indigo-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto pb-2">
        {/* Global chat, always pinned on top */}
        {(!term || "global chat".includes(term)) && (
          <ChatRow
            active={activeChat === null}
            onClick={() => onSelect(null)}
            avatar={<GlobalAvatar />}
            title="Global chat"
            subtitle="Everyone in the room"
            unread={unread[GLOBAL_KEY]}
          />
        )}

        <p className="px-4 pt-4 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Private chats
        </p>

        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-sm leading-relaxed text-slate-400">
            {term ? "No chats found." : "No private chats yet. Tap a name in the global chat, or use + to start one."}
          </p>
        )}

        {filtered.map((c) => {
          const last = c.lastMessage;
          const preview = last ? (last.sender === username ? `You: ${last.text}` : last.text) : "Say hi 👋";
          return (
            <ChatRow
              key={c.with}
              active={activeChat === c.with}
              onClick={() => onSelect(c.with)}
              avatar={<Avatar name={c.with} />}
              title={c.with}
              subtitle={preview}
              time={last ? formatShort(last.createdAt) : undefined}
              unread={unread[c.with]}
            />
          );
        })}
      </nav>
    </aside>
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
  subtitle: string;
  time?: string;
  unread?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
        active ? "bg-indigo-50" : "hover:bg-slate-50"
      }`}
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`truncate font-medium ${active ? "text-indigo-700" : "text-slate-800"}`}>{title}</p>
          {time && <span className={`shrink-0 text-[11px] ${unread ? "font-semibold text-indigo-600" : "text-slate-400"}`}>{time}</span>}
        </div>
        <div className="flex items-center justify-between">
          <p className={`truncate text-sm ${unread ? "font-medium text-slate-700" : "text-slate-500"}`}>{subtitle}</p>
          <UnreadBadge count={unread} />
        </div>
      </div>
    </button>
  );
}
