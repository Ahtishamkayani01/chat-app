export interface Message {
  _id: string;
  sender: string;
  text: string;
  createdAt: string;
  updatedAt: string;
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

export const api = {
  list: () => request<Message[]>(BASE),
};
