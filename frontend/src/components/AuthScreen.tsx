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
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <div
        className={`group flex items-center gap-2.5 rounded-xl border bg-slate-50 px-3.5 transition focus-within:bg-white focus-within:ring-4 ${
          error
            ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-100"
            : "border-slate-200 focus-within:border-indigo-400 focus-within:ring-indigo-100"
        }`}
      >
        <span className="text-slate-400 transition group-focus-within:text-indigo-500">
          <Icon>{icons[icon]}</Icon>
        </span>
        <input
          {...input}
          className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-slate-800 outline-none placeholder:text-slate-400"
        />
        {trailing}
      </div>
      {error ? (
        <span className="mt-1.5 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
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
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-950 p-4">
      {/* Background glow blobs */}
      <div className="pointer-events-none absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-indigo-600/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-40 h-[30rem] w-[30rem] rounded-full bg-fuchsia-600/30 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/40 md:grid-cols-[1fr_1.1fr]">
        {/* Brand panel */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-10 text-white md:flex">
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-64 w-64 rounded-full border-[40px] border-white/10" />
          <div className="pointer-events-none absolute top-10 -right-10 h-24 w-24 rounded-full bg-white/10" />

          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight">ChatApp</span>
          </div>

          <div className="relative">
            <h2 className="text-3xl leading-tight font-bold">
              Talk to everyone.
              <br />
              Or just one.
            </h2>
            <p className="mt-3 max-w-xs text-sm text-white/75">
              A global room for the whole crowd, and private one-on-one chats when you need them.
            </p>

            <ul className="mt-8 space-y-3 text-sm">
              {[
                ["⚡", "Real-time messages, no refresh"],
                ["🔒", "Private DMs only you two can see"],
                ["✏️", "Edit or delete what you've sent"],
              ].map(([emoji, text]) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
                    {emoji}
                  </span>
                  <span className="text-white/90">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-white/50">© {new Date().getFullYear()} ChatApp</p>
        </aside>

        {/* Form panel */}
        <section className="p-7 sm:p-10">
          {/* Mobile logo */}
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg md:hidden">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
              <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            {isRegister ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isRegister ? "It takes less than a minute." : "Sign in to pick up where you left off."}
          </p>

          {/* Mode tabs */}
          <div className="relative mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium">
            <span
              className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-white shadow-sm transition-transform duration-300 ${
                isRegister ? "translate-x-full" : ""
              }`}
            />
            {(["signin", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`relative z-10 rounded-lg py-2 transition ${
                  mode === m ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "signin" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
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
                  placeholder="e.g. ahtisham"
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
                placeholder="ahtisham or you@example.com"
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
                          i <= strength ? STRENGTH[strength].color : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="w-16 text-right text-xs text-slate-500">{STRENGTH[strength].label}</span>
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3 font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-xl hover:shadow-indigo-500/30 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {busy ? (isRegister ? "Creating account…" : "Signing in…") : isRegister ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {isRegister ? "Already have an account? " : "New here? "}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? "signin" : "register")}
              className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              {isRegister ? "Sign in" : "Create an account"}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
