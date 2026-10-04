export function safeNext(value: string | null | undefined, fallback = "/workspace") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "https://solvren.invalid");
    return parsed.origin === "https://solvren.invalid" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch { return fallback; }
}
