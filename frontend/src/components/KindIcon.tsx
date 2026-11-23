import type { AttachmentKind } from "@/types/chat";

// Small line icons for attachment kinds (sidebar preview, voice label...).
// They use currentColor, so they match whatever text color they sit in.
const PATHS: Record<AttachmentKind | "voice", React.ReactNode> = {
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 18 5-5 3.5 3.5L15 14l5 4.5" />
    </>
  ),
  video: (
    <>
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="m15.5 10.5 5-3v9l-5-3" />
    </>
  ),
  audio: (
    <>
      <path d="M9 18V6l11-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>
  ),
  voice: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  document: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  archive: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M12 4v2m0 2v2m0 2v2" />
      <rect x="10.5" y="14" width="3" height="3" rx="0.8" />
    </>
  ),
};

export default function KindIcon({
  kind,
  voice = false,
  className = "h-4 w-4",
}: {
  kind: AttachmentKind;
  /** Show a mic instead of a music note (recorded voice messages) */
  voice?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {PATHS[voice ? "voice" : kind]}
    </svg>
  );
}
