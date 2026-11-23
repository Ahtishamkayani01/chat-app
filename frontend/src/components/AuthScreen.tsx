"use client";

import { FormEvent, ReactNode, useState } from "react";
import { useLoginMutation, useRegisterMutation } from "@/store/api/chatApi";
import { getErrorMessage } from "@/lib/errors";
import type { Session } from "@/lib/auth";

type Mode = "signin" | "register";

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- small building blocks ----------

const icons = {
  user: (
    <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" strokeLinecap="round" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
    </>
  ),
};

const FEATURES = [
  {
    text: "Real-time messages, no refresh",
    icon: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" strokeLinejoin="round" />,
  },
  {
    text: "Private chats only you two can see",
    icon: (
      <>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2" strokeLinecap="round" />
      </>
    ),
  },
  {
    text: "Groups, photos, files and voice notes",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.2a3 3 0 0 1 0 5.6M18 14.3c1.8.7 3 2.4 3 5" strokeLinecap="round" />
      </>
    ),
  },
  {
    text: "Edit or delete what you've sent",
    icon: <path d="m14.5 5.5 4 4M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5 4 20Z" strokeLinecap="round" strokeLinejoin="round" />,
  },
];

/** Same mark as the browser tab icon (src/app/icon.svg) */
function Logo({ className = "", solid = false }: { className?: string; solid?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      {solid ? (
        <rect width="64" height="64" rx="16" fill="#2b4de0" />
      ) : (
        <>
          <rect width="64" height="64" rx="16" fill="#fff" fillOpacity="0.16" />
          <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" fill="none" stroke="#fff" strokeOpacity="0.25" />
        </>
      )}
      <path
        d="M32 15c-10 0-18 6.9-18 15.5 0 4.6 2.3 8.7 6 11.5l-1.6 7.3 8.3-4.3c1.7.4 3.5.6 5.3.6 10 0 18-6.9 18-15.5S42 15 32 15Z"
        fill="#fff"
      />
      <circle cx="24.5" cy="30.5" r="2.6" fill="#2b4de0" />
      <circle cx="32" cy="30.5" r="2.6" fill="#2b4de0" />
      <circle cx="39.5" cy="30.5" r="2.6" fill="#2b4de0" />
    </svg>
  );
}

function Icon({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      {children}
    </svg>
  );
}

function Field({
  label,
  icon,
  hint,
  error,
  trailing,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: keyof typeof icons;
  hint?: string;
  error?: string | null;
  trailing?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>
      <div
        className={`group flex items-center gap-2.5 rounded-lg border bg-white px-3 transition focus-within:ring-2 ${
          error
            ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-100"
            : "border-stone-300 focus-within:border-accent-400 focus-within:ring-accent-100"
        }`}
      >
        <span className="text-stone-400 transition group-focus-within:text-stone-600">
          <Icon>{icons[icon]}</Icon>
        </span>
        <input
          {...input}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-stone-800 outline-none placeholder:text-stone-400"
        />
        {trailing}
      </div>
      {error ? (
        <span className="mt-1.5 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-stone-400">{hint}</span>
      ) : null}
    </label>
  );
}

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
      title={shown ? "Hide password" : "Show password"}
      tabIndex={-1}
    >
      <Icon className="h-[18px] w-[18px]">
        {shown ? (
          <path
            d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a12 12 0 0 1-3.3 4.3M6.6 6.6C4.4 8 2.8 10.1 2 12c1 2.5 5 7 10 7 1.6 0 3.1-.4 4.4-1.1"
            strokeLinecap="round"
          />
        ) : (
          <>
            <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </>
        )}
      </Icon>
    </button>
  );
}

/** 0–4 score: length, mixed case, digit, symbol. */
function passwordStrength(pw: string) {
  if (!pw) return 0;
  let score = pw.length >= 6 ? 1 : 0;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
}

const STRENGTH = [
  { label: "Too short", color: "bg-red-400" },
  { label: "Weak", color: "bg-orange-400" },
  { label: "Okay", color: "bg-amber-400" },
  { label: "Good", color: "bg-lime-500" },
  { label: "Strong", color: "bg-emerald-500" },
];

// ---------- screen ----------

export default function AuthScreen({ onAuthed }: { onAuthed: (session: Session) => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false); // show field errors only after first submit
  const [error, setError] = useState<string | null>(null);

  const [login, { isLoading: loggingIn }] = useLoginMutation();
  const [register, { isLoading: registering }] = useRegisterMutation();
  const busy = loggingIn || registering;
  const isRegister = mode === "register";

  // Field validation (register only; sign-in just needs both fields filled)
  const name = username.trim().toLowerCase();
  const errors = {
    username: !USERNAME_RE.test(name) ? "3–30 characters: letters, numbers, . _ -" : null,
    email: !EMAIL_RE.test(email.trim()) ? "Enter a valid email address" : null,
    password: password.length < 6 ? "At least 6 characters" : null,
    confirm: confirm !== password ? "Passwords don't match" : null,
  };
  const show = (e: string | null) => (touched ? e : null);
  const strength = passwordStrength(password);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setTouched(false);
    setPassword("");
    setConfirm("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setTouched(true);

    try {
      if (isRegister) {
        if (Object.values(errors).some(Boolean)) return;
        const session = await register({ username: name, email: email.trim(), password }).unwrap();
        onAuthed(session);
      } else {
        if (!identifier.trim() || !password) return setError("Enter your username/email and password");
        const session = await login({ identifier: identifier.trim(), password }).unwrap();
        onAuthed(session);
      }
    } catch (err) {
      setError(getErrorMessage(err, isRegister ? "Could not create account" : "Could not sign in"));
    }
  }

  return (
    <main className="relative flex h-dvh items-center justify-center overflow-hidden bg-ink p-3 sm:p-6">
      {/* Background glow blobs */}
      <div className="pointer-events-none absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-accent-600/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-40 h-[30rem] w-[30rem] rounded-full bg-amber-500/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-400/15 blur-3xl" />

      <div className="relative grid max-h-full w-full max-w-[880px] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-3xl bg-white/10 p-1.5 shadow-2xl shadow-black/50 ring-1 ring-white/15 backdrop-blur-2xl md:grid-cols-[1fr_1.1fr]">
        {/* Brand panel */}
        <aside className="relative hidden flex-col gap-12 overflow-hidden rounded-[20px] bg-gradient-to-br from-accent-500 via-accent-600 to-accent-900 p-10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] md:flex">
          {/* Gloss: soft light across the top + a diagonal shine */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent" />
          <div className="pointer-events-none absolute -top-1/4 -left-1/3 h-[150%] w-1/2 rotate-[25deg] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="relative flex items-center gap-2.5">
            <Logo className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight">ChatApp</span>
          </div>

          <div className="relative my-auto">
            <h2 className="text-[28px] leading-tight font-semibold">
              Talk to everyone.
              <br />
              Or just one.
            </h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/75">
              A global room for the whole crowd, groups for your people, and private chats when you need them.
            </p>

            <ul className="mt-8 space-y-3.5 text-sm">
              {FEATURES.map((f) => (
                <li key={f.text} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] ring-1 ring-white/25 backdrop-blur">
                    <Icon className="h-[18px] w-[18px]">{f.icon}</Icon>
                  </span>
                  <span className="text-white/90">{f.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-white/50">© ChatApp</p>
        </aside>

        <section className="relative min-h-0 overflow-y-auto overscroll-contain rounded-[20px] bg-white p-6 sm:p-10">
          <div className="mb-6 flex items-center gap-2.5 md:hidden">
            <Logo solid className="h-9 w-9" />
            <span className="font-semibold text-stone-900">ChatApp</span>
          </div>

          <h1 className="text-2xl font-semibold text-stone-900">
            {isRegister ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {isRegister ? "Pick a username people can find you by." : "Sign in with your username or email."}
          </p>

          {/* Mode tabs */}
          <div className="relative mt-6 grid grid-cols-2 rounded-lg bg-stone-100 p-1 text-sm font-medium">
            <span
              className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md bg-white ring-1 ring-stone-200 transition-transform duration-200 ${
                isRegister ? "translate-x-full" : ""
              }`}
            />
            {(["signin", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`relative z-10 rounded-md py-1.5 transition ${
                  mode === m ? "text-stone-900" : "text-stone-500 hover:text-stone-700"
                }`}
              >
                {m === "signin" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              <Icon className="mt-px h-4 w-4 shrink-0">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4m0 4h.01" strokeLinecap="round" />
              </Icon>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
            {isRegister ? (
              <>
                <Field
                  label="Username"
                  icon="user"
                  autoFocus
                  autoComplete="username"
                  placeholder="Username"
                  maxLength={30}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  hint="This is how others find you."
                  error={show(errors.username)}
                />
                <Field
                  label="Email"
                  icon="mail"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={show(errors.email)}
                />
              </>
            ) : (
              <Field
                label="Username or email"
                icon="user"
                autoFocus
                autoComplete="username"
                placeholder="Username or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            )}

            <div>
              <Field
                label="Password"
                icon="lock"
                type={showPassword ? "text" : "password"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                placeholder={isRegister ? "At least 6 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={isRegister ? show(errors.password) : null}
                trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />}
              />
              {isRegister && password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          i <= strength ? STRENGTH[strength].color : "bg-stone-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="w-16 text-right text-xs text-stone-500">{STRENGTH[strength].label}</span>
                </div>
              )}
            </div>

            {isRegister && (
              <Field
                label="Confirm password"
                icon="lock"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Type it again"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={show(errors.confirm)}
              />
            )}

            <button
              type="submit"
              disabled={busy}
              className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl gloss-accent bg-accent-600 py-3 font-semibold text-white transition hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {busy ? (isRegister ? "Creating account…" : "Signing in…") : isRegister ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone-500">
            {isRegister ? "Already have an account? " : "New here? "}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? "signin" : "register")}
              className="font-medium text-accent-700 hover:underline"
            >
              {isRegister ? "Sign in" : "Create an account"}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
