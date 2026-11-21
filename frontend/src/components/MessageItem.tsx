"use client";

import { useState } from "react";
import type { Message } from "@/types/chat";
import { formatTime } from "@/lib/format";
import { Avatar } from "./Avatar";

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

type Props = {
  message: Message;
  mine: boolean;
  /** First message in a run from the same sender (shows name + avatar in global chat). */
  showSender: boolean;
  /** Global chat shows avatars and names; private chat doesn't need them. */
  isGlobal: boolean;
  onOpenDm: (name: string) => void;
  onEdit: (id: string, text: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
};

export default function MessageItem({
  message: m,
  mine,
  showSender,
  isGlobal,
  onOpenDm,
  onEdit,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const edited = m.updatedAt !== m.createdAt;

  async function save() {
    const value = editText.trim();
    if (!value || value === m.text) return setEditing(false);
    if (await onEdit(m._id, value)) setEditing(false);
  }

  const showAvatarColumn = isGlobal && !mine;

  return (
    <div className={`group flex gap-2 ${mine ? "justify-end" : "justify-start"} ${showSender ? "mt-3" : "mt-0.5"}`}>
      {showAvatarColumn && (
        <div className="w-8 shrink-0">
          {showSender && (
            <button onClick={() => onOpenDm(m.sender)} title={`Message ${m.sender} privately`}>
              <Avatar name={m.sender} size="sm" />
            </button>
          )}
        </div>
      )}

      <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {editing ? (
          <div className="w-80 max-w-full rounded-2xl border border-indigo-200 bg-white p-3 shadow-lg">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
              <PencilIcon /> Edit message
            </p>
            <textarea
              autoFocus
              rows={3}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  save();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              maxLength={1000}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">Enter to save · Esc to cancel</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={!editText.trim() || editText.trim() === m.text}
                  className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {/* Hover actions (left side of my bubbles) */}
            {mine && !confirming && (
              <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                <button
                  onClick={() => {
                    setEditText(m.text);
                    setEditing(true);
                  }}
                  title="Edit"
                  className="rounded-full p-1.5 text-slate-400 hover:bg-white hover:text-indigo-600 hover:shadow-sm"
                >
                  <PencilIcon />
                </button>
                <button
                  onClick={() => setConfirming(true)}
                  title="Delete"
                  className="rounded-full p-1.5 text-slate-400 hover:bg-white hover:text-red-600 hover:shadow-sm"
                >
                  <TrashIcon />
                </button>
              </div>
            )}

            <div
              className={`relative rounded-2xl px-3.5 py-2 shadow-sm ${
                mine
                  ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                  : "bg-white text-slate-800 ring-1 ring-slate-900/5"
              } ${showSender ? (mine ? "rounded-tr-md" : "rounded-tl-md") : ""} ${
                confirming ? "ring-2 ring-red-400 ring-offset-2" : ""
              }`}
            >
              {isGlobal && !mine && showSender && (
                <button
                  onClick={() => onOpenDm(m.sender)}
                  className="mb-0.5 block text-xs font-semibold text-indigo-600 hover:underline"
                  title={`Message ${m.sender} privately`}
                >
                  {m.sender}
                </button>
              )}
              <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
                {m.text}
                {/* Invisible spacer so the timestamp never overlaps text */}
                <span className="invisible ml-2 inline-block text-[10px]">
                  {edited && "edited "}00:00 AM
                </span>
              </p>
              <span
                className={`absolute right-3 bottom-1.5 text-[10px] ${mine ? "text-white/70" : "text-slate-400"}`}
              >
                {edited && "edited · "}
                {formatTime(m.createdAt)}
              </span>
            </div>
          </div>
        )}

        {confirming && (
          <div className="mt-1 flex items-center gap-1.5 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700 ring-1 ring-red-100">
            <span className="font-medium">Delete this message?</span>
            <button
              onClick={() => setConfirming(false)}
              className="rounded px-2 py-0.5 font-medium text-slate-600 hover:bg-white"
            >
              No
            </button>
            <button
              onClick={async () => {
                await onDelete(m._id);
                setConfirming(false);
              }}
              className="rounded bg-red-600 px-2 py-0.5 font-medium text-white hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
