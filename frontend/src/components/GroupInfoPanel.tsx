"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Room } from "@/types/chat";
import { getErrorMessage } from "@/lib/errors";
import { isAdmin, sortedMembers } from "@/lib/rooms";
import { Avatar, GroupAvatar } from "./Avatar";
import MemberPicker from "./MemberPicker";

type Props = {
  room: Room;
  me: string;
  onClose: () => void;
  // All of these throw on failure; the panel shows the error.
  onAddMembers: (usernames: string[]) => Promise<void>;
  onRemoveMember: (username: string) => Promise<void>;
  onRename: (name: string) => Promise<void>;
  onLeave: () => Promise<void>;
  onMessage: (username: string) => void;
};

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`h-3.5 w-3.5 animate-spin rounded-full border-2 ${
        light ? "border-white/40 border-t-white" : "border-slate-200 border-t-slate-600"
      }`}
    />
  );
}

/** Slide-in panel (from the right) with the group's details and members. */
export default function GroupInfoPanel({
  room,
  me,
  onClose,
  onAddMembers,
  onRemoveMember,
  onRename,
  onLeave,
  onMessage,
}: Props) {
  const admin = isAdmin(room, me);
  const members = sortedMembers(room, me);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // which action is running

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(room.name ?? "");
  const [adding, setAdding] = useState(false);
  const [newMembers, setNewMembers] = useState<string[]>([]);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Run an action, show a spinner on it, and show the error if it fails. */
  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    const name = nameDraft.trim();
    if (!name || name === room.name) return setEditingName(false);
    if (await run("rename", () => onRename(name))) setEditingName(false);
  }

  async function addPicked() {
    if (!newMembers.length) return;
    if (await run("add", () => onAddMembers(newMembers))) {
      setNewMembers([]);
      setAdding(false);
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex animate-[fade-in_150ms_ease-out] justify-end bg-slate-900/30 backdrop-blur-[2px]"
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full animate-[slide-in-right_220ms_ease-out] flex-col bg-slate-50 shadow-2xl sm:w-[400px]"
      >
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3">
          <button
            onClick={onClose}
            title="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
          <h2 className="font-semibold text-slate-800">Group info</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Identity */}
          <section className="flex flex-col items-center bg-white px-6 pt-7 pb-6 text-center">
            <GroupAvatar name={room.name ?? ""} size="lg" />

            {editingName ? (
              <form onSubmit={saveName} className="mt-4 flex w-full max-w-xs gap-2">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), setEditingName(false))}
                  maxLength={50}
                  className="min-w-0 flex-1 rounded-xl border border-indigo-300 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-100"
                />
                <button
                  type="submit"
                  disabled={!nameDraft.trim() || busy === "rename"}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy === "rename" ? <Spinner light /> : "Save"}
                </button>
              </form>
            ) : (
              <div className="mt-4 flex items-center gap-1.5">
                <h3 className="text-xl font-semibold text-slate-800">{room.name}</h3>
                {admin && (
                  <button
                    onClick={() => {
                      setNameDraft(room.name ?? "");
                      setEditingName(true);
                    }}
                    title="Rename group"
                    className="rounded-full p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            <p className="mt-1 text-sm text-slate-500">
              Group · {room.members.length} {room.members.length === 1 ? "member" : "members"}
            </p>
            {room.createdBy && (
              <p className="mt-0.5 text-xs text-slate-400">
                Created by {room.createdBy === me ? "you" : room.createdBy} ·{" "}
                {new Date(room.createdAt).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
              </p>
            )}
          </section>

          {error && (
            <div className="mx-4 mt-3 flex items-start justify-between gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-xs font-semibold hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Members */}
          <section className="mt-3 bg-white">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h4 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                {room.members.length} members
              </h4>
            </div>

            {admin && !adding && (
              <button
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-indigo-50/60"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                    <circle cx="9" cy="8" r="3.5" />
                    <path d="M2.5 20c0-3.6 2.9-6 6.5-6 1.6 0 3 .4 4.1 1.2M18 13v6M15 16h6" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="font-medium text-indigo-600">Add members</span>
              </button>
            )}

            {adding && (
              <div className="mx-4 mb-2 animate-[pop_140ms_ease-out] rounded-2xl bg-indigo-50/60 p-3 ring-1 ring-indigo-100">
                <MemberPicker me={me} value={newMembers} onChange={setNewMembers} exclude={room.members} autoFocus />
                <div className="mt-2.5 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setAdding(false);
                      setNewMembers([]);
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void addPicked()}
                    disabled={!newMembers.length || busy === "add"}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {busy === "add" && <Spinner light />}
                    Add {newMembers.length > 0 && newMembers.length}
                  </button>
                </div>
              </div>
            )}

            <ul className="pb-2">
              {members.map((m) => {
                const isMe = m === me;
                const memberIsAdmin = room.admins.includes(m);
                return (
                  <li key={m} className="group/member px-5 py-2 transition hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <Avatar name={m} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-800">{isMe ? "You" : m}</p>
                        <p className="text-xs text-slate-400">{isMe ? `@${m}` : memberIsAdmin ? "Group admin" : "Member"}</p>
                      </div>
                      {memberIsAdmin && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                          Admin
                        </span>
                      )}
                      {!isMe && confirmRemove !== m && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => onMessage(m)}
                            title={`Message ${m}`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                              <path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
                            </svg>
                          </button>
                          {admin && (
                            <button
                              onClick={() => setConfirmRemove(m)}
                              title={`Remove ${m}`}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                                <circle cx="9" cy="8" r="3.5" />
                                <path d="M2.5 20c0-3.6 2.9-6 6.5-6 1.6 0 3 .4 4.1 1.2M15 16h6" strokeLinecap="round" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {confirmRemove === m && (
                      <div className="mt-2 flex animate-[pop_140ms_ease-out] items-center gap-2 rounded-xl bg-red-50 py-1.5 pr-1.5 pl-3 text-xs ring-1 ring-red-100">
                        <span className="flex-1 font-medium text-red-700">
                          Remove {m}? Their messages stay in the chat.
                        </span>
                        <button
                          onClick={() => setConfirmRemove(null)}
                          className="rounded-lg px-2.5 py-1 font-semibold text-slate-600 hover:bg-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (await run(`remove:${m}`, () => onRemoveMember(m))) setConfirmRemove(null);
                          }}
                          disabled={busy === `remove:${m}`}
                          className="flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          {busy === `remove:${m}` && <Spinner light />}
                          Remove
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Leave */}
          <section className="mt-3 mb-6 bg-white p-2">
            {confirmLeave ? (
              <div className="animate-[pop_140ms_ease-out] rounded-xl bg-red-50 p-3 ring-1 ring-red-100">
                <p className="text-sm font-semibold text-red-700">Leave &ldquo;{room.name}&rdquo;?</p>
                <p className="mt-0.5 text-xs text-red-600/80">
                  You won&apos;t get new messages. Your old messages stay in the group.
                  {admin && room.admins.length === 1 && room.members.length > 1 && " Another member will become admin."}
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => setConfirmLeave(false)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void run("leave", onLeave)}
                    disabled={busy === "leave"}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {busy === "leave" && <Spinner light />}
                    Leave group
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmLeave(true)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-medium text-red-600 transition hover:bg-red-50"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                  <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Leave group
              </button>
            )}
          </section>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
