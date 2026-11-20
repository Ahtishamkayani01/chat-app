export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

// "Today", "Yesterday", or "Mon, 18 Nov"
export function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

// Sidebar timestamp: time if today, otherwise short date
export function formatShort(iso: string) {
  const d = new Date(iso);
  if (sameDay(d, new Date())) return formatTime(iso);
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

export function isSameDay(a: string, b: string) {
  return sameDay(new Date(a), new Date(b));
}
