const COLORS = [
  "from-rose-400 to-rose-600",
  "from-orange-400 to-orange-600",
  "from-amber-400 to-amber-600",
  "from-emerald-400 to-emerald-600",
  "from-teal-400 to-teal-600",
  "from-sky-400 to-sky-600",
  "from-indigo-400 to-indigo-600",
  "from-violet-400 to-violet-600",
  "from-fuchsia-400 to-fuchsia-600",
];

// Same name -> same color, every time.
function colorFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
};

export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof SIZES }) {
  return (
    <div
      className={`${SIZES[size]} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-sm ${colorFor(name)}`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

export function GlobalAvatar({ size = "md" }: { size?: keyof typeof SIZES }) {
  return (
    <div
      className={`${SIZES[size]} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-1/2 w-1/2">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
      </svg>
    </div>
  );
}

/** Group avatar: the group's color (from its name) with a "people" icon. */
export function GroupAvatar({ name, size = "md" }: { name: string; size?: keyof typeof SIZES | "lg" }) {
  const box = size === "lg" ? "h-20 w-20" : SIZES[size];
  return (
    <div
      className={`${box} flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm ${colorFor(name || "group")}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-1/2 w-1/2">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" strokeLinecap="round" />
        <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.3c1.8.7 3 2.4 3 5" strokeLinecap="round" />
      </svg>
    </div>
  );
}
