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
  create: (sender: string, text: string) =>
    request<Message>(BASE, { method: "POST", body: JSON.stringify({ sender, text }) }),
  update: (id: string, text: string) =>
    request<Message>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify({ text }) }),
  remove: (id: string) => request<{ message: string }>(`${BASE}/${id}`, { method: "DELETE" }),
};
