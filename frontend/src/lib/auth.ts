// Where the logged-in session (JWT + username) lives in the browser.

const TOKEN_KEY = "chat-token";
const NAME_KEY = "chat-username";

export type Session = { token: string; username: string };

/** Fired when the server rejects our token, so the UI can drop back to the sign-in screen. */
export const SESSION_EXPIRED_EVENT = "chat:session-expired";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null; // server render: no localStorage
  const token = localStorage.getItem(TOKEN_KEY);
  const username = localStorage.getItem(NAME_KEY);
  return token && username ? { token, username } : null;
}

export function saveSession({ token, username }: Session) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(NAME_KEY, username);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
}

/** Clear the stored session and tell the app it is no longer valid. */
export function expireSession() {
  clearSession();
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
