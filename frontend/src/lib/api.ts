export interface Message {
  _id: string;
  sender: string;
  receiver?: string | null; // null/missing = global chat
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  with: string; // the other person's username
  lastMessage: Message;
}

const BASE = "/api/messages";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.Message || `Request failed (${res.status})`);
  }
  return data as T;
}

const q = encodeURIComponent;

export const api = {
  // Global chat history
  list: () => request<Message[]>(BASE),
  // Private chat history between `user` and `other`
  dm: (user: string, other: string) =>
    request<Message[]>(`${BASE}/dm?user=${q(user)}&with=${q(other)}`),
  // Sidebar list: everyone `user` has a DM with, newest first
  conversations: (user: string) =>
    request<Conversation[]>(`${BASE}/conversations?user=${q(user)}`),
  // Throws "User ... does not exist" (404) if nobody has that username
  getUser: (username: string) => request<{ username: string }>(`/api/users/${q(username)}`),
};
