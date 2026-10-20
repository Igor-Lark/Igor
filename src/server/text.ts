export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

export function isSiteHost(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === "boat-sochi.ru" || host.endsWith(".boat-sochi.ru");
  } catch {
    return false;
  }
}

export function hostnameOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}
