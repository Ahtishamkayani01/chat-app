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
