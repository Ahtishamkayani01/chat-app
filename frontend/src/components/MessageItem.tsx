"use client";

import { useEffect, useRef, useState } from "react";
import type { DeleteScope, Message, MessageStatus } from "@/types/chat";
import { formatTime } from "@/lib/format";
import { DELETED_TEXT, DELETE_FOR_EVERYONE_LIMIT_MS } from "@/lib/attachments";
import { Avatar } from "./Avatar";
import AttachmentView from "./AttachmentView";
import DeleteMessageDialog from "./DeleteMessageDialog";

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

function BanIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0" aria-hidden="true">
      <circle cx="10" cy="10" r="7" />
      <path d="M5 15 15 5" strokeLinecap="round" />
    </svg>
  );
}

const STATUS_LABEL: Record<MessageStatus, string> = {
  sent: "Sent",
  delivered: "Delivered",
  seen: "Seen",
};

/** ✓ sent, ✓✓ delivered, ✓✓ in light blue when seen (readable on the cobalt bubble) */
function Ticks({ status }: { status: MessageStatus }) {
  return (
    <svg
      viewBox="0 0 18 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3 w-[18px] shrink-0 ${status === "seen" ? "text-sky-300" : ""}`}
      role="img"
      aria-label={STATUS_LABEL[status]}
    >
      <title>{STATUS_LABEL[status]}</title>
      {status === "sent" ? (
        <path d="M3.5 6.5 7 10l6.5-7.5" />
      ) : (
        <>
          <path d="M1 6.5 4.5 10 11 2.5" />
          <path d="m8.5 9.5.5.5 6.5-7.5" />
        </>
      )}
    </svg>
  );
}

type Props = {
  message: Message;
  mine: boolean;
  /** Ticks for my messages in direct/group chats (undefined = no ticks). */
  status?: MessageStatus;
  /** First message in a run from the same sender (shows name + avatar in global chat). */
  showSender: boolean;
  /** Global + group chats show avatars and names; a 1-to-1 chat doesn't need them. */
  showNames: boolean;
  onOpenDm: (name: string) => void;
  onEdit: (id: string, text: string) => Promise<boolean>;
  onDelete: (id: string, scope: DeleteScope) => Promise<void>;
};

export default function MessageItem({
  message: m,
  mine,
  status,
  showSender,
  showNames,
  onOpenDm,
  onEdit,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false); // Edit/Delete menu (tap on mobile)
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState<DeleteScope | null>(null);
  const [canDeleteForEveryone, setCanDeleteForEveryone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const deleted = !!m.deletedForEveryone; // placeholder: no text, no file
  const edited = !deleted && m.updatedAt !== m.createdAt;
  const a = deleted ? undefined : m.attachment;
  const isMedia = a?.kind === "image" || a?.kind === "video";
  const canEdit = mine && !deleted && !!m.text; // edit = change the text / caption

  // Close the action menu when tapping anywhere outside this message.
  // (The delete popup handles its own closing: backdrop, Cancel, Esc.)
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  // Tap a bubble to show its actions. Phones have no hover, so this is how
  // mobile users reach Edit/Delete. Taps on links, players and buttons are ignored.
  function onBubbleClick(e: React.MouseEvent) {
    if (confirming) return; // anyone can open the menu: "delete for me" works on every message
    if ((e.target as HTMLElement).closest("a, button, video, audio, [data-interactive]")) return;
    if (window.getSelection()?.toString()) return; // user is selecting text
    setMenuOpen((open) => !open);
  }

  function startEdit() {
    setEditText(m.text);
    setEditing(true);
    setMenuOpen(false);
  }

  function askDelete() {
    setMenuOpen(false);
    // Only the sender, only once, only within the time limit (the server checks too)
    const age = Date.now() - new Date(m.createdAt).getTime();
    setCanDeleteForEveryone(mine && !deleted && age < DELETE_FOR_EVERYONE_LIMIT_MS);
    setConfirming(true);
  }

  async function confirmDelete(scope: DeleteScope) {
    setDeleting(scope);
    await onDelete(m._id, scope);
    setDeleting(null);
    setConfirming(false);
  }

  async function save() {
    const value = editText.trim();
    if (!value || value === m.text) return setEditing(false);
    if (await onEdit(m._id, value)) setEditing(false);
  }

  const showAvatarColumn = showNames && !mine;
  const timeLabel = `${edited ? "edited · " : ""}${formatTime(m.createdAt)}`;
  // time + ticks, used both for the visible stamp and its invisible spacer
  const meta = (
    <>
      {timeLabel}
      {status && <Ticks status={status} />}
    </>
  );

  return (
    <div
      ref={rootRef}
      className={`group flex gap-2 ${mine ? "justify-end" : "justify-start"} ${showSender ? "mt-3" : "mt-0.5"}`}
    >
      {showAvatarColumn && (
        <div className="w-8 shrink-0">
          {showSender && (
            <button onClick={() => onOpenDm(m.sender)} title={`Message ${m.sender} privately`}>
              <Avatar name={m.sender} size="sm" />
            </button>
          )}
        </div>
      )}

      <div className={`flex max-w-[85%] flex-col sm:max-w-[78%] ${mine ? "items-end" : "items-start"}`}>
        {/* Action menu: opens when you tap your own bubble (works on mobile + desktop) */}
        {menuOpen && !editing && (
          <div className="mb-1.5 flex animate-[pop_140ms_ease-out] items-center gap-0.5 rounded-lg border border-stone-200 bg-white p-0.5 shadow-sm">
            {canEdit && (
              <>
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-accent-50 hover:text-accent-600"
                >
                  <PencilIcon /> Edit
                </button>
                <span className="h-4 w-px bg-stone-200" />
              </>
            )}
            <button
              onClick={askDelete}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              <TrashIcon /> Delete
            </button>
          </div>
        )}

        {editing ? (
          <div className="w-80 max-w-full rounded-lg border border-stone-300 bg-white p-3 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-stone-500">
              <PencilIcon /> {a ? "Edit caption" : "Edit message"}
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
              className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800 outline-none focus:border-stone-400"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="hidden text-[11px] text-stone-400 sm:inline">Enter to save · Esc to cancel</span>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={!editText.trim() || editText.trim() === m.text}
                  className="rounded-lg gloss-accent bg-accent-600 px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {/* Desktop only: quick hover buttons. Hidden on touch screens,
                where invisible buttons would catch taps by accident. */}
            {!confirming && !menuOpen && (
              <div className="hidden gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 pointer-fine:flex">
                {canEdit && (
                  <button
                    onClick={startEdit}
                    title="Edit"
                    className="rounded-full p-1.5 text-stone-400 hover:bg-white hover:text-accent-600"
                  >
                    <PencilIcon />
                  </button>
                )}
                <button
                  onClick={askDelete}
                  title="Delete"
                  className="rounded-full p-1.5 text-stone-400 hover:bg-white hover:text-red-600"
                >
                  <TrashIcon />
                </button>
              </div>
            )}

            <div
              onClick={onBubbleClick}
              className={`relative rounded-xl transition ${
                a ? (isMedia ? "p-1" : "p-2") : "px-3.5 py-2"
              } cursor-pointer ${
                deleted
                  ? mine
                    ? "bg-accent-50 text-accent-400 ring-1 ring-accent-100"
                    : "bg-white/70 text-stone-400 ring-1 ring-stone-200"
                  : mine
                    ? "gloss-accent bg-accent-600 text-white"
                    : "gloss-surface bg-white text-stone-800"
              } ${showSender ? (mine ? "rounded-tr-md" : "rounded-tl-md") : ""} ${
                confirming
                  ? "ring-2 ring-red-300"
                  : menuOpen
                    ? "ring-2 ring-stone-300"
                    : ""
              }`}
            >
              {showNames && !mine && showSender && (
                <button
                  onClick={() => onOpenDm(m.sender)}
                  className={`mb-0.5 block text-xs font-semibold text-accent-600 hover:underline ${a ? "px-2 pt-1" : ""}`}
                  title={`Message ${m.sender} privately`}
                >
                  {m.sender}
                </button>
              )}

              {a && <AttachmentView attachment={a} mine={mine} />}

              {deleted ? (
                <p className="flex items-center gap-1.5 text-[14px] leading-snug italic">
                  <BanIcon />
                  {mine ? "You deleted this message" : DELETED_TEXT}
                  <span className="invisible ml-2 inline-block text-[10px]">{timeLabel}</span>
                </p>
              ) : m.text ? (
                <p
                  className={`text-[15px] leading-snug break-words whitespace-pre-wrap ${
                    a ? (isMedia ? "px-2.5 pt-1.5 pb-1" : "px-1.5 pt-1.5") : ""
                  }`}
                >
                  {m.text}
                  {/* Invisible spacer so the timestamp never overlaps text */}
                  <span className="invisible ml-2 inline-flex items-center gap-0.5 text-[10px]">{meta}</span>
                </p>
              ) : (
                // Room for the timestamp under a file / voice note without caption
                !isMedia && <div className="h-3.5" />
              )}

              <span
                className={`pointer-events-none absolute inline-flex items-center gap-0.5 text-[10px] ${
                  !m.text && isMedia
                    ? "right-2.5 bottom-2.5 rounded-full bg-black/45 px-1.5 py-0.5 text-white"
                    : `right-3 bottom-1.5 ${mine && !deleted ? "text-white/70" : "text-stone-400"}`
                }`}
              >
                {meta}
              </span>
            </div>
          </div>
        )}

        {confirming && (
          <DeleteMessageDialog
            message={m}
            mine={mine}
            canDeleteForEveryone={canDeleteForEveryone}
            deleting={deleting}
            onDelete={(scope) => void confirmDelete(scope)}
            onClose={() => setConfirming(false)}
          />
        )}
      </div>
    </div>
  );
}
