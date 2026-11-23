import type { Room } from "@/types/chat";

/** Name to show for a room: "Global chat", the other person in a DM, or the group name. */
export function roomTitle(room: Room, me: string) {
  if (room.type === "global") return "Global chat";
  if (room.type === "direct") return room.members.find((m) => m !== me) ?? me;
  return room.name || "Group";
}

/** Newest activity first (rooms with no messages yet use their creation time). */
export function byLatestActivity(a: Room, b: Room) {
  const at = (r: Room) => new Date(r.lastMessage?.at ?? r.createdAt).getTime();
  return at(b) - at(a);
}

export const isAdmin = (room: Room, me: string) => room.admins.includes(me);

/** Members in display order: me first, then admins, then everyone else A→Z. */
export function sortedMembers(room: Room, me: string) {
  const rank = (m: string) => (m === me ? 0 : room.admins.includes(m) ? 1 : 2);
  return [...room.members].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** Header line for a group: "4 members · You, ali, sara, +1" */
export function groupSubtitle(room: Room, me: string) {
  const names = sortedMembers(room, me).map((m) => (m === me ? "You" : m));
  const shown = names.slice(0, 3).join(", ");
  const more = names.length > 3 ? `, +${names.length - 3}` : "";
  return `${room.members.length} members · ${shown}${more}`;
}
