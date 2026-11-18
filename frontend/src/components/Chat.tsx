"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api, type Message } from "@/lib/api";

const NAME_KEY = "chat-username";
const POLL_MS = 3000;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
      <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function Chat() {
  const [username, setUsername] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  // Restore the saved name after mount (localStorage is browser-only).
  useEffect(() => {
    const saved = localStorage.getItem(NAME_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setUsername(saved);
  }, []);

  const load = useCallback(async (): Promise<boolean> => {
    try {
      const data = await api.list();
      setMessages(data);
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
      return false;
    }
  }, []);

  // Poll for new messages while a user is logged in. Each poll waits for the
  // previous one to finish, and backs off (up to 30s) while requests fail.
  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let delay = POLL_MS;
    const tick = async () => {
      const ok = await load();
      if (cancelled) return;
      delay = ok ? POLL_MS : Math.min(delay * 2, 30000);
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, load]);

  // Scroll to bottom only when new messages arrive.
  useEffect(() => {
    if (messages.length > lastCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    lastCount.current = messages.length;
  }, [messages]);

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
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || !username || sending) return;
    setSending(true);
    try {
      const msg = await api.create(username, value);
      setMessages((prev) => [...prev, msg]);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function handleSaveEdit(id: string) {
    const value = editText.trim();
    if (!value) return;
    try {
      const updated = await api.update(id, value);
      setMessages((prev) => prev.map((m) => (m._id === id ? updated : m)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.remove(id);
      setMessages((prev) => prev.filter((m) => m._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  if (!username) {
    return (
      <main className="flex flex-1 items-center justify-center bg-slate-100 p-4">
        <form
          onSubmit={handleJoin}
          className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-lg"
        >
          <h1 className="text-2xl font-bold text-slate-800">Join the chat</h1>
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Your name"
            maxLength={30}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <button
            type="submit"
            disabled={!nameInput.trim()}
            className="w-full rounded-lg bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Enter
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex flex-1 justify-center bg-slate-100 sm:p-4">
      <div className="flex h-dvh w-full max-w-2xl flex-col overflow-hidden bg-white shadow-lg sm:h-[calc(100dvh-2rem)] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-indigo-600 px-5 py-3 text-white">
          <h1 className="text-lg font-semibold">ChatApp</h1>
          <div className="flex items-center gap-3 text-sm">
            <span>
              Signed in as <strong>{username}</strong>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-md bg-white/20 px-2 py-1 hover:bg-white/30"
            >
              Leave
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 px-5 py-2 text-sm text-red-700">{error}</div>
        )}

        <section className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
          {messages.length === 0 && (
            <p className="mt-10 text-center text-sm text-slate-400">
              No messages yet. Say hi!
            </p>
          )}

          {messages.map((m) => {
            const mine = m.sender === username;
            const editing = editingId === m._id;
            const confirming = confirmDeleteId === m._id;
            const edited = m.updatedAt !== m.createdAt;
            return (
              <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[80%] flex-col ${mine ? "items-end" : "items-start"}`}>
                  {!mine && (
                    <p className="mb-1 ml-1 text-xs font-medium text-slate-500">{m.sender}</p>
                  )}

                  {editing ? (
                    <div className="w-72 max-w-full rounded-2xl border-2 border-indigo-400 bg-white p-3 shadow-md">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
                        <PencilIcon /> Editing message
                      </p>
                      <textarea
                        autoFocus
                        rows={3}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSaveEdit(m._id);
                          }
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        maxLength={1000}
                        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Enter to save · Esc to cancel</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(m._id)}
                            disabled={!editText.trim() || editText.trim() === m.text}
                            className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`rounded-2xl px-4 py-2 shadow-sm ${
                        mine
                          ? "rounded-br-sm bg-indigo-600 text-white"
                          : "rounded-bl-sm bg-white text-slate-800"
                      } ${confirming ? "ring-2 ring-red-400 ring-offset-2" : ""}`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    </div>
                  )}

                  <div className="mt-1 flex items-center gap-2 px-1 text-[11px] text-slate-400">
                    <span>
                      {formatTime(m.createdAt)}
                      {edited && " · edited"}
                    </span>

                    {mine && !editing && !confirming && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setConfirmDeleteId(null);
                            setEditingId(m._id);
                            setEditText(m.text);
                          }}
                          title="Edit message"
                          className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <PencilIcon /> Edit
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setConfirmDeleteId(m._id);
                          }}
                          title="Delete message"
                          className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                        >
                          <TrashIcon /> Delete
                        </button>
                      </div>
                    )}

                    {confirming && (
                      <div className="flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-0.5 text-red-700">
                        <span className="font-medium">Delete this message?</span>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded px-1.5 py-0.5 font-medium text-slate-600 hover:bg-white"
                        >
                          No
                        </button>
                        <button
                          onClick={() => handleDelete(m._id)}
                          className="rounded bg-red-600 px-1.5 py-0.5 font-medium text-white hover:bg-red-700"
                        >
                          Yes, delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </section>

        <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 p-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            maxLength={1000}
            className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="rounded-full bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}
