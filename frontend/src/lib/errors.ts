/**
 * Turn any error into a readable message:
 * - RTK Query errors  → { status, data: { message } } or { status, error }
 * - socket / JS errors → Error.message
 */
export function getErrorMessage(err: unknown, fallback = "Something went wrong") {
  if (err && typeof err === "object") {
    const e = err as { data?: { message?: unknown }; error?: unknown; message?: unknown };
    if (typeof e.data?.message === "string") return e.data.message;
    if (typeof e.error === "string") return e.error;
    if (typeof e.message === "string") return e.message;
  }
  return fallback;
}
