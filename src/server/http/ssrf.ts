import dns from "dns/promises";
import net from "net";

export class UrlPolicyError extends Error {
  readonly code = "URL_BLOCKED";

  constructor(message: string) {
    super(message);
    this.name = "UrlPolicyError";
  }
}

export type ResolvedAddress = { address: string; family: number };
export type ResolveHost = (hostname: string) => Promise<ResolvedAddress[]>;

const SITE_HOST = "boat-sochi.ru";

export function isBlockedIp(address: string): boolean {
  const mapped = address.toLowerCase().match(/:ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const v4 = mapped ? mapped[1] : net.isIP(address) === 4 ? address : null;
  if (v4) return isBlockedIpv4(v4);
  if (net.isIP(address) === 6) return isBlockedIpv6(address.toLowerCase());
  return true;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return (((numbers[0] << 24) | (numbers[1] << 16) | (numbers[2] << 8) | numbers[3]) >>> 0);
}

function inCidr(ip: number, base: string, bits: number): boolean {
  const start = ipv4ToInt(base);
  if (start === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mask) === (start & mask);
}

function isBlockedIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return true;
  const ranges: Array<[string, number]> = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ];
  return ranges.some(([base, bits]) => inCidr(value, base, bits));
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }
  if (normalized.startsWith("ff")) return true;
  return false;
}

export function assertHostnamePolicy(hostname: string, siteOnly: boolean): string {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) throw new UrlPolicyError("Пустой адрес.");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    host === "metadata"
  ) {
    throw new UrlPolicyError("Служебное имя хоста запрещено.");
  }
  if (/^\d+$/.test(host)) {
    throw new UrlPolicyError("Числовой адрес запрещён.");
  }
  if (siteOnly && host !== SITE_HOST && !host.endsWith(`.${SITE_HOST}`)) {
    throw new UrlPolicyError("Загрузчик страниц принимает только boat-sochi.ru и его поддомены.");
  }
  if (net.isIP(host) && isBlockedIp(host)) {
    throw new UrlPolicyError("Внутренний или служебный IP-адрес запрещён.");
  }
  return host;
}

export function parseHttpUrl(raw: string, siteOnly: boolean): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UrlPolicyError("Некорректный URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlPolicyError("Разрешены только http и https.");
  }
  if (url.username || url.password) {
    throw new UrlPolicyError("Адрес с логином или паролем запрещён.");
  }
  assertHostnamePolicy(url.hostname, siteOnly);
  return url;
}

async function defaultResolve(hostname: string): Promise<ResolvedAddress[]> {
  if (net.isIP(hostname)) {
    return [{ address: hostname, family: net.isIP(hostname) === 6 ? 6 : 4 }];
  }
  const found = await dns.lookup(hostname, { all: true, verbatim: true });
  return found.map((item) => ({ address: item.address, family: item.family }));
}

export async function resolvePublicAddress(
  hostname: string,
  resolveHost: ResolveHost = defaultResolve,
): Promise<ResolvedAddress> {
  const host = assertHostnamePolicy(hostname, false);
  let addresses: ResolvedAddress[];
  try {
    addresses = await resolveHost(host);
  } catch (error) {
    if (error instanceof UrlPolicyError) throw error;
    throw new UrlPolicyError(`Не удалось разрешить имя ${host}.`);
  }
  if (!addresses.length) throw new UrlPolicyError(`Имя ${host} не разрешилось в адрес.`);
  for (const item of addresses) {
    if (isBlockedIp(item.address)) {
      throw new UrlPolicyError(`Имя ${host} указывает на внутренний адрес ${item.address}.`);
    }
  }
  return addresses[0];
}

export async function authorizeUrl(
  raw: string,
  options: { siteOnly: boolean; resolveHost?: ResolveHost },
): Promise<{ url: URL; address: ResolvedAddress }> {
  const url = parseHttpUrl(raw, options.siteOnly);
  const address = await resolvePublicAddress(url.hostname, options.resolveHost);
  return { url, address };
}
