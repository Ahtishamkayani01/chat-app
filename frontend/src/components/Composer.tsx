"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ACCEPT, checkFile, extOf, formatBytes, formatDuration, kindOfFile } from "@/lib/attachments";
import FileIcon from "./FileIcon";

const MAX_VOICE_SECONDS = 5 * 60;

type Props = {
  placeholder: string;
  disabled: boolean;
  /** Upload (if a file is given) and send. Resolves true on success. */
  onSend: (text: string, file?: File) => Promise<boolean>;
  onError: (message: string) => void;
};

/**
 * Message input: text, attach a file (button or paste), or record a voice note.
 * Chat renders it with key={roomId}, so everything resets when switching rooms.
 */
export default function Composer({ placeholder, disabled, onSend, onError }: Props) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // local image/video preview
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);

  // voice recording
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const sendOnStop = useRef(false); // false = cancelled
  const startedAt = useRef(0);

  // Recording timer (+ auto-stop at the max length)
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(s);
      if (s >= MAX_VOICE_SECONDS) {
        sendOnStop.current = true;
        recorder.current?.stop();
      }
    }, 250);
    return () => clearInterval(id);
  }, [recording]);

  // Leaving the room while recording: throw the recording away, free the mic
  useEffect(
    () => () => {
      sendOnStop.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
    },
    [],
  );

  // ---------- file ----------

  function pickFile(f: File) {
    const problem = checkFile(f);
    if (problem) return onError(problem);
    clearFile();
    const kind = kindOfFile(f.name);
    setFile(f);
    setPreviewUrl(kind === "image" || kind === "video" ? URL.createObjectURL(f) : null);
    textArea.current?.focus();
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    if (fileInput.current) fileInput.current.value = ""; // so picking the same file again still fires onChange
  }

  // ---------- send ----------

  async function submit(value: string, f?: File) {
    if (sending) return;
    setSending(true);
    const ok = await onSend(value, f);
    setSending(false);
    if (ok) {
      setText("");
      clearFile();
    }
  }

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const value = text.trim();
    if ((!value && !file) || disabled) return;
    void submit(value, file ?? undefined);
  }

  // ---------- voice ----------

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return onError("Voice recording isn't supported in this browser");
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return onError("Microphone access was blocked. Allow it in your browser settings.");
    }

    // Chrome/Firefox record webm, Safari records mp4
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    sendOnStop.current = false;

    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop()); // turn the mic light off
      recorder.current = null;
      setRecording(false);
      if (!sendOnStop.current || !chunks.current.length) return;

      const type = rec.mimeType || "audio/webm";
      // ".weba" (not ".webm") so the backend files it as audio, not video
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "weba";
      const blob = new Blob(chunks.current, { type: type.split(";")[0] });
      void submit("", new File([blob], `voice-note-${Date.now()}.${ext}`, { type: blob.type }));
    };

    recorder.current = rec;
    rec.start();
    startedAt.current = Date.now();
    setElapsed(0);
    setRecording(true);
  }

  function stopRecording(send: boolean) {
    sendOnStop.current = send;
    recorder.current?.stop();
  }

  // ---------- UI ----------

  const canSend = (!!text.trim() || !!file) && !disabled && !sending;
  const showMic = !text.trim() && !file && !recording;
  const fileKind = file ? kindOfFile(file.name) : null;

  return (
    <div className="border-t border-stone-200 bg-white px-3 pt-2 pb-3">
      {/* Selected file preview */}
      {file && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-2 pr-3">
          {previewUrl && fileKind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
          ) : previewUrl && fileKind === "video" ? (
            <video src={previewUrl} muted className="h-14 w-14 rounded-xl bg-black object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white ring-1 ring-stone-200">
              <FileIcon ext={extOf(file.name)} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-stone-800">{file.name}</p>
            <p className="flex items-center gap-1.5 text-xs text-stone-500">
              {formatBytes(file.size)} ·{" "}
              {sending ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent-200 border-t-accent-600" />
                  Uploading…
                </>
              ) : (
                "Add a caption or press send"
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={clearFile}
            disabled={sending}
            title="Remove file"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-white hover:text-stone-700 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Voice note being sent */}
      {sending && !file && !text && (
        <p className="mb-2 flex items-center gap-2 px-2 text-xs text-stone-500">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent-200 border-t-accent-600" />
          Sending voice message…
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {recording ? (
          <div className="flex h-11 flex-1 items-center gap-3 rounded-xl bg-red-50 px-3 ring-1 ring-red-100">
            <button
              type="button"
              onClick={() => stopRecording(false)}
              title="Cancel recording"
              className="flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-white"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4.5 w-4.5">
                <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="font-mono text-sm text-red-700 tabular-nums">{formatDuration(elapsed)}</span>
            <span className="flex-1 truncate text-sm text-red-600/80">Recording…</span>
          </div>
        ) : (
          <>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={sending}
              title="Attach a photo, video or file"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5.5 w-5.5">
                <path
                  d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <textarea
              ref={textArea}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              // Paste a screenshot straight into the chat
              onPaste={(e) => {
                const f = e.clipboardData.files?.[0];
                if (f) {
                  e.preventDefault();
                  pickFile(f.name ? f : new File([f], `pasted.${f.type.split("/")[1] || "png"}`, { type: f.type }));
                }
              }}
              placeholder={file ? "Add a caption…" : placeholder}
              maxLength={1000}
              className="field-sizing-content max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-2.5 text-[15px] text-stone-800 outline-none focus:border-accent-300 focus:bg-white focus:ring-2 focus:ring-accent-100"
            />
          </>
        )}

        {showMic ? (
          <button
            type="button"
            onClick={() => void startRecording()}
            disabled={disabled || sending}
            title="Record a voice message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <button
            type={recording ? "button" : "submit"}
            onClick={recording ? () => stopRecording(true) : undefined}
            disabled={recording ? false : !canSend}
            title="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full gloss-accent bg-accent-600 text-white transition hover:brightness-110 disabled:bg-stone-300"
          >
            {sending ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 translate-x-px">
                <path d="M3.4 20.4 20.85 12.9a1 1 0 0 0 0-1.8L3.4 3.6a.99.99 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91Z" />
              </svg>
            )}
          </button>
        )}
      </form>
    </div>
  );
}
