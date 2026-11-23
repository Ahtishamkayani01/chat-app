"use client";

import { useState } from "react";
import { useLazyGetUserQuery } from "@/store/api/chatApi";
import { Avatar } from "./Avatar";

type Props = {
  me: string;
  value: string[]; // picked usernames
  onChange: (usernames: string[]) => void;
  /** People who can't be picked (already in the group) */
  exclude?: string[];
  autoFocus?: boolean;
};

/**
 * Type a username + Enter → we check it exists (GET /users/:username) → it
 * becomes a chip. Backspace on an empty input removes the last chip.
 */
export default function MemberPicker({ me, value, onChange, exclude = [], autoFocus }: Props) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [getUser] = useLazyGetUserQuery();

  async function add() {
    const name = input.trim().toLowerCase().replace(/^@/, "");
    if (!name || checking) return;
    if (name === me) return setError("You're added automatically");
    if (exclude.includes(name)) return setError(`${name} is already in the group`);
    if (value.includes(name)) return setError(`${name} is already added`);

    setChecking(true);
    try {
      await getUser(name, true).unwrap(); // true = reuse a cached answer
      onChange([...value, name]);
      setInput("");
      setError(null);
    } catch {
      setError(`No user called "${name}"`);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-xl border bg-slate-50 p-1.5 transition focus-within:bg-white focus-within:ring-4 ${
          error
            ? "border-red-300 focus-within:ring-red-100"
            : "border-slate-200 focus-within:border-indigo-400 focus-within:ring-indigo-100"
        }`}
      >
        {value.map((name) => (
          <span
            key={name}
            className="flex animate-[pop_140ms_ease-out] items-center gap-1.5 rounded-full bg-white py-0.5 pr-1 pl-0.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200"
          >
            <Avatar name={name} size="xs" />
            {name}
            <button
              type="button"
              onClick={() => onChange(value.filter((n) => n !== name))}
              title={`Remove ${name}`}
              className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        ))}

        <input
          autoFocus={autoFocus}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === " ") {
              e.preventDefault();
              void add();
            }
            if (e.key === "Backspace" && !input && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={value.length ? "Add another…" : "Type a username and press Enter"}
          maxLength={30}
          className="min-w-32 flex-1 bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />

        {input.trim() && (
          <button
            type="button"
            onClick={() => void add()}
            disabled={checking}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {checking && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            Add
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
