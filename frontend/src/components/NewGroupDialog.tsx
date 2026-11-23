"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getErrorMessage } from "@/lib/errors";
import { GroupAvatar } from "./Avatar";
import MemberPicker from "./MemberPicker";

type Props = {
  me: string;
  onClose: () => void;
  /** Creates the group and opens it. Throws on failure. */
  onCreate: (name: string, members: string[]) => Promise<void>;
};

/** "New group" dialog: bottom sheet on phones, centered card on desktop. */
export default function NewGroupDialog({ me, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canCreate = !!name.trim() && members.length > 0 && !creating;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    try {
      await onCreate(name.trim(), members);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not create the group"));
      setCreating(false);
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex animate-[fade-in_150ms_ease-out] items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full animate-[sheet-up_200ms_ease-out] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl"
      >
        {/* Header with live preview of the group's avatar + name */}
        <div className="relative bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-6 pt-6 pb-5 text-white">
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex items-center gap-4">
            <div className="rounded-2xl ring-4 ring-white/30">
              <GroupAvatar name={name.trim() || "New group"} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wider text-white/70 uppercase">New group</p>
              <p className="truncate text-lg font-semibold">{name.trim() || "Untitled group"}</p>
              <p className="text-xs text-white/80">
                {members.length + 1} {members.length === 0 ? "member (you)" : "members"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Group name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend plans"
              maxLength={50}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
          </label>

          <div>
            <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-slate-700">
              Members
              <span className="text-xs font-normal text-slate-400">You&apos;ll be the admin</span>
            </span>
            <MemberPicker me={me} value={members} onChange={setMembers} />
          </div>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canCreate}
            className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-40"
          >
            {creating && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            Create group
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
