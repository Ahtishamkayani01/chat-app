"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { DeleteScope, Message } from "@/types/chat";
import { DELETE_FOR_EVERYONE_LIMIT_MS, messagePreview } from "@/lib/attachments";

type Props = {
  message: Message;
  mine: boolean;
  canDeleteForEveryone: boolean;
  deleting: DeleteScope | null; // which button is spinning
  onDelete: (scope: DeleteScope) => void;
  onClose: () => void;
};

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`h-4 w-4 animate-spin rounded-full border-2 ${
        light ? "border-white/40 border-t-white" : "border-red-200 border-t-red-600"
      }`}
    />
  );
}

/** WhatsApp-style "Delete message?" popup, centred over the chat. */
export default function DeleteMessageDialog({
  message,
  mine,
  canDeleteForEveryone,
  deleting,
  onDelete,
  onClose,
}: Props) {
  const busy = deleting !== null;
  const preview = messagePreview(message).text;
  const minutes = Math.round(DELETE_FOR_EVERYONE_LIMIT_MS / 60000);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  // Portal: render on <body> so it sits above everything.
  // stopPropagation: React events bubble through portals, so a click here
  // must not reach the message bubble (which toggles its menu).
  return createPortal(
    <div
      data-interactive
      onClick={(e) => {
        e.stopPropagation();
        if (!busy) onClose();
      }}
      className="fixed inset-0 z-50 flex animate-[fade-in_120ms_ease-out] items-center justify-center bg-stone-900/40 p-4"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[360px] animate-[sheet-up_160ms_ease-out] overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/25"
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-100">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-5 w-5">
                <path
                  d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 id="delete-title" className="text-base font-semibold text-stone-900">
                Delete message?
              </h2>
              <p className="text-xs text-stone-500">
                {mine ? "Sent by you" : `From ${message.sender}`}
              </p>
            </div>
          </div>

          {/* What is being deleted */}
          <p className="mt-4 line-clamp-2 rounded-lg border-l-[3px] border-accent-400 bg-stone-50 px-3 py-2 text-sm break-words text-stone-600">
            {preview}
          </p>

          <p className="mt-3 text-xs leading-relaxed text-stone-500">
            {canDeleteForEveryone
              ? "Delete for everyone removes it for all members. Delete for me only removes it from your chat."
              : mine && !message.deletedForEveryone
                ? `It's only possible to delete for everyone within ${minutes} minutes of sending. You can still remove it from your chat.`
                : "This only removes it from your chat. Others will still see it."}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-stone-100 bg-stone-50/70 p-3">
          {canDeleteForEveryone && (
            <button
              type="button"
              autoFocus
              onClick={() => onDelete("everyone")}
              disabled={busy}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 bg-gradient-to-b from-red-500 to-red-600 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15)] transition hover:brightness-110 disabled:opacity-60"
            >
              {deleting === "everyone" && <Spinner light />}
              Delete for everyone
            </button>
          )}
          <button
            type="button"
            autoFocus={!canDeleteForEveryone}
            onClick={() => onDelete("me")}
            disabled={busy}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 disabled:opacity-60"
          >
            {deleting === "me" && <Spinner />}
            Delete for me
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-11 items-center justify-center rounded-xl text-sm font-medium text-stone-600 transition hover:bg-stone-100 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
