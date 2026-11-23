// A paper-sheet icon with a colored extension badge (PDF red, DOCX blue, ...)
const BADGE_COLORS: [string[], string][] = [
  [["pdf"], "bg-red-500"],
  [["doc", "docx"], "bg-blue-500"],
  [["xls", "xlsx"], "bg-emerald-500"],
  [["ppt", "pptx"], "bg-orange-500"],
  [["zip", "rar", "7z"], "bg-amber-500"],
  [["mp3", "wav", "ogg", "m4a", "weba"], "bg-fuchsia-500"],
  [["mp4", "mov", "webm"], "bg-violet-500"],
];

export default function FileIcon({ ext }: { ext: string }) {
  const color = BADGE_COLORS.find(([exts]) => exts.includes(ext))?.[1] ?? "bg-slate-500";
  return (
    <div className="relative h-12 w-10 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 40 48" className="h-full w-full">
        <path d="M5 0h21l14 14v29a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5V5a5 5 0 0 1 5-5Z" fill="#fff" stroke="#d6d3d1" strokeWidth="1" />
        <path d="M26 0v9a5 5 0 0 0 5 5h9Z" fill="#e7e5e4" />
      </svg>
      <span
        className={`absolute bottom-2 left-1/2 -translate-x-1/2 rounded px-1 py-px text-[8px] leading-tight font-bold tracking-wide text-white uppercase ${color}`}
      >
        {(ext || "file").slice(0, 4)}
      </span>
    </div>
  );
}
