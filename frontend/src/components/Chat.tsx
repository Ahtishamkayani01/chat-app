"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, type Conversation, type Message } from "@/lib/api";
import { socket, emitAsync } from "@/lib/socket";
import { formatDay, isSameDay } from "@/lib/format";
import { Avatar, GlobalAvatar } from "./Avatar";
import MessageItem from "./MessageItem";
import Sidebar, { GLOBAL_KEY } from "./Sidebar";

const NAME_KEY = "chat-username";

// ---------- helpers ----------

/** Which chat does this message belong to, from my point of view? null = global. */
function chatOf(m: Message, me: string): string | null {
  if (!m.receiver) return null;
  return m.sender === me ? m.receiver : m.sender;
}

function addUnique(list: Message[], msg: Message) {
  return list.some((m) => m._id === msg._id) ? list : [...list, msg];
}

/** Put this conversation at the top with its newest message. */
function bumpConversation(list: Conversation[], other: string, msg: Message) {
  const current = list.find((c) => c.with === other);
  if (current && new Date(current.lastMessage.createdAt) > new Date(msg.createdAt)) return list;
  return [{ with: other, lastMessage: msg }, ...list.filter((c) => c.with !== other)];
}

// ---------- component ----------

export default function Chat() {
  const [username, setUsername] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");

  const [activeChat, setActiveChat] = useState<string | null>(null); // null = global
  const activeChatRef = useRef<string | null>(null); // read inside socket listeners
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const conversationsRef = useRef<Conversation[]>([]); // read inside socket listeners
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false); // true once connected AND joined
  const [syncKey, setSyncKey] = useState(0); // bump to reload history (e.g. after reconnect)

  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Restore saved name after mount (localStorage is browser-only).
  useEffect(() => {
    const saved = localStorage.getItem(NAME_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setUsername(saved);
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!username) return;
    try {
      setConversations(await api.conversations(username));
    } catch {
      /* sidebar is non-critical */
    }
  }, [username]);

  // Load history for the open chat (global or DM). Re-runs when chat changes or after reconnect.
  useEffect(() => {
    if (!username) return;
    let cancelled = false; // ignore late responses if the user switched chats meanwhile
    (async () => {
      try {
        const data = activeChat ? await api.dm(username, activeChat) : await api.list();
        if (!cancelled) {
          setMessages(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load messages");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username, activeChat, syncKey]);

  // Real-time connection.
  useEffect(() => {
    if (!username) return;
    const me = username;

    async function onConnect() {
      try {
        await emitAsync("user:join", { username: me }); // join my personal room
        setConnected(true);
        setSyncKey((k) => k + 1); // re-sync history in case we missed messages
        refreshConversations();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to join");
      }
    }
    function onDisconnect() {
      setConnected(false);
    }

    function onNew(msg: Message) {
      const chat = chatOf(msg, me);
      if (chat) setConversations((prev) => bumpConversation(prev, chat, msg));

      if (chat === activeChatRef.current) {
        setMessages((prev) => addUnique(prev, msg));
      } else if (msg.sender !== me) {
        const key = chat ?? GLOBAL_KEY;
        setUnread((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
      }
    }

    function onUpdated(msg: Message) {
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m)));
      setConversations((prev) =>
        prev.map((c) => (c.lastMessage._id === msg._id ? { ...c, lastMessage: msg } : c)),
      );
    }

    function onDeleted({ id }: { id: string }) {
      setMessages((prev) => prev.filter((m) => m._id !== id));
      // If the sidebar preview was this message, fetch the new latest one.
      if (conversationsRef.current.some((c) => c.lastMessage._id === id)) refreshConversations();
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("message:new", onNew);
    socket.on("message:updated", onUpdated);
    socket.on("message:deleted", onDeleted);
    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("message:new", onNew);
      socket.off("message:updated", onUpdated);
      socket.off("message:deleted", onDeleted);
      socket.disconnect();
      setConnected(false);
    };
  }, [username, refreshConversations]);

  // Scroll to bottom when messages are added; jump instantly when switching chats.
  useEffect(() => {
    if (messages.length > lastCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: lastCount.current === 0 ? "auto" : "smooth" });
    }
    lastCount.current = messages.length;
  }, [messages]);

  // ---------- actions ----------

  function selectChat(chat: string | null) {
    setMobileShowChat(true);
    setUnread((prev) => ({ ...prev, [chat ?? GLOBAL_KEY]: 0 }));
    if (chat === activeChat) return;
    activeChatRef.current = chat;
    setActiveChat(chat);
    setMessages([]);
    lastCount.current = 0;
    setLoading(true);
    setText("");
  }

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem(NAME_KEY, name);
    setUsername(name);
  }

  function handleLogout() {
    localStorage.removeItem(NAME_KEY);
    setUsername(null);
    setMessages([]);
    setConversations([]);
    setUnread({});
    activeChatRef.current = null;
    setActiveChat(null);
    setMobileShowChat(false);
  }

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    const value = text.trim();
    if (!value || !username || sending) return;
    setSending(true);
    try {
      const msg = await emitAsync<Message>("message:send", { text: value, receiver: activeChat });
      setMessages((prev) => addUnique(prev, msg));
      if (activeChat) setConversations((prev) => bumpConversation(prev, activeChat, msg));
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function handleEdit(id: string, value: string) {
    try {
      const updated = await emitAsync<Message>("message:edit", { id, text: value });
      setMessages((prev) => prev.map((m) => (m._id === id ? updated : m)));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
      return false;
    }
  }

  async function handleDelete(id: string) {
    try {
      await emitAsync("message:delete", { id });
      setMessages((prev) => prev.filter((m) => m._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  // ---------- login screen ----------

  if (!username) {
    return (
      <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-4">
        <form
          onSubmit={handleJoin}
          className="w-full max-w-sm rounded-3xl bg-white/95 p-8 shadow-2xl backdrop-blur"
        >
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-7 w-7">
              <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-center text-2xl font-bold text-slate-800">Welcome to ChatApp</h1>
          <p className="mt-1 mb-6 text-center text-sm text-slate-500">
            Chat with everyone, or privately one-on-one.
          </p>
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Pick a username"
            maxLength={30}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
          <button
            type="submit"
            disabled={!nameInput.trim()}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-50"
          >
            Start chatting
          </button>
        </form>
      </main>
    );
  }

  // ---------- main layout ----------

  const isGlobal = activeChat === null;

  return (
    <main className="flex flex-1 bg-slate-200 lg:p-5">
      <div className="mx-auto flex h-dvh w-full max-w-6xl overflow-hidden bg-white shadow-xl lg:h-[calc(100dvh-2.5rem)] lg:rounded-2xl">
        <Sidebar
          username={username}
          conversations={conversations}
          activeChat={activeChat}
          unread={unread}
          connected={connected}
          onSelect={selectChat}
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
            {activeChat === null ? <GlobalAvatar /> : <Avatar name={activeChat} />}
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold text-slate-800">{isGlobal ? "Global chat" : activeChat}</h2>
              <p className="truncate text-xs text-slate-500">
                {isGlobal ? "Everyone · tap a name to message privately" : "🔒 Private chat · only you two can see this"}
              </p>
            </div>
          </header>

          {!connected && (
            <div className="bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-700">
              Connecting…
            </div>
          )}
          {error && (
            <div className="flex items-center justify-between bg-red-50 px-4 py-1.5 text-xs text-red-700">
              <span>{error}</span>
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
                <div className="mb-3 flex justify-center">
                  {activeChat === null ? <GlobalAvatar /> : <Avatar name={activeChat} />}
                </div>
                <p className="font-medium text-slate-700">
                  {isGlobal ? "No messages yet" : `Start chatting with ${activeChat}`}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {isGlobal ? "Be the first to say hi!" : "Messages here are only visible to you two."}
                </p>
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
                    isGlobal={isGlobal}
                    onOpenDm={selectChat}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-slate-200 bg-white px-3 py-3">
            <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isGlobal ? "Message everyone…" : `Message ${activeChat}…`}
              maxLength={1000}
              className="field-sizing-content max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] text-slate-800 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending || !connected}
              title="Send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md transition hover:scale-105 disabled:scale-100 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 translate-x-px">
                <path d="M3.4 20.4 20.85 12.9a1 1 0 0 0 0-1.8L3.4 3.6a.99.99 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91Z" />
              </svg>
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
