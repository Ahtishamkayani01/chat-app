"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Attachment } from "@/types/chat";
import { audioUrl, formatBytes, formatDuration, imageThumbUrl, isVoiceNote } from "@/lib/attachments";
import FileIcon from "./FileIcon";
import KindIcon from "./KindIcon";

type Props = { attachment: Attachment; mine: boolean };

/**
 * Shows a message's attachment, straight from the Cloudinary CDN.
 * Everything here is marked data-interactive so tapping it doesn't open the
 * message's Edit/Delete menu (see MessageItem).
 */
export default function AttachmentView({ attachment: a, mine }: Props) {
  if (a.kind === "image") return <ImageAttachment a={a} />;
  if (a.kind === "video") return <VideoAttachment a={a} />;
  if (a.kind === "audio") return <AudioPlayer a={a} mine={mine} />;
  return <FileCard a={a} mine={mine} />;
}

const MEDIA_WIDTH = "w-[240px] sm:w-[300px]";
const aspect = (a: Attachment) => (a.width && a.height ? `${a.width} / ${a.height}` : "4 / 3");

// ---------- image ----------

function ImageAttachment({ a }: { a: Attachment }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <button
        type="button"
        data-interactive
        onClick={() => setOpen(true)}
        title="View photo"
        className={`block overflow-hidden rounded-xl ${MEDIA_WIDTH} ${loaded ? "" : "animate-pulse bg-slate-300/60"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary already resizes/optimizes */}
        <img
          src={imageThumbUrl(a)}
          alt={a.name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{ aspectRatio: aspect(a) }}
          className="block max-h-96 w-full object-cover transition hover:brightness-95"
        />
      </button>
      {open && <Lightbox a={a} onClose={() => setOpen(false)} />}
    </>
  );
}

function Lightbox({ a, onClose }: { a: Attachment; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portal: render on <body> so it covers the whole screen.
  // stopPropagation: React events bubble through portals, and we don't want
  // a click here to toggle the message menu.
  return createPortal(
    <div
      data-interactive
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={a.url}
        alt={a.name}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
      />
      <div className="absolute top-4 right-4 flex gap-2">
        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
        >
          Open original
        </a>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ---------- video ----------

function VideoAttachment({ a }: { a: Attachment }) {
  return (
    <video
      data-interactive
      src={a.url}
      poster={a.thumbnailUrl}
      controls
      playsInline
      preload="metadata"
      style={{ aspectRatio: aspect(a) }}
      className={`block max-h-96 rounded-xl bg-black object-contain ${MEDIA_WIDTH}`}
    />
  );
}

// ---------- audio / voice note ----------

function AudioPlayer({ a, mine }: { a: Attachment; mine: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(a.duration ?? 0);
  const pct = duration ? Math.min(100, (current / duration) * 100) : 0;
  const voice = isVoiceNote(a);

  function toggle() {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }

  function seek(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || !duration) return;
    const box = e.currentTarget.getBoundingClientRect();
    el.currentTime = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * duration;
  }

  return (
    <div data-interactive className="flex w-60 max-w-full items-center gap-3 py-1 pr-1">
      <audio
        ref={ref}
        src={audioUrl(a)}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
      />
      <button
        type="button"
        onClick={toggle}
        title={playing ? "Pause" : "Play"}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm transition active:scale-95 ${
          mine ? "bg-white text-indigo-600" : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
        }`}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 translate-x-px">
            <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.8-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        {!voice && (
          <p className={`mb-1 truncate text-xs font-medium ${mine ? "text-white" : "text-slate-700"}`}>{a.name}</p>
        )}
        {/* Progress bar: tap/click anywhere on it to seek */}
        <div onPointerDown={seek} className="group/bar relative flex h-4 cursor-pointer items-center">
          <div className={`h-1.5 w-full rounded-full ${mine ? "bg-white/30" : "bg-slate-200"}`}>
            <div
              className={`h-full rounded-full ${mine ? "bg-white" : "bg-indigo-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={`absolute h-3 w-3 -translate-x-1/2 rounded-full shadow ${mine ? "bg-white" : "bg-indigo-600"}`}
            style={{ left: `${pct}%` }}
          />
        </div>
        <div className={`mt-0.5 flex justify-between text-[11px] ${mine ? "text-white/75" : "text-slate-500"}`}>
          <span className="flex items-center gap-1">
            {voice ? (
              <>
                <KindIcon kind="audio" voice className="h-3.5 w-3.5" /> Voice message
              </>
            ) : (
              formatBytes(a.size)
            )}
          </span>
          <span className="tabular-nums">{formatDuration(playing || current ? current : duration)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------- document / archive ----------

function FileCard({ a, mine }: { a: Attachment; mine: boolean }) {
  return (
    <a
      data-interactive
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${a.name}`}
      className={`flex w-64 max-w-full items-center gap-3 rounded-xl p-2.5 transition ${
        mine ? "bg-white/15 hover:bg-white/25" : "bg-slate-50 ring-1 ring-slate-200 hover:bg-slate-100"
      }`}
    >
      <FileIcon ext={a.ext} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${mine ? "text-white" : "text-slate-800"}`}>{a.name}</p>
        <p className={`text-xs ${mine ? "text-white/70" : "text-slate-500"}`}>
          {a.ext.toUpperCase()} · {formatBytes(a.size)}
        </p>
      </div>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          mine ? "bg-white/20 text-white" : "bg-white text-indigo-600 shadow-sm"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </a>
  );
}
