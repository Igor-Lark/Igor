import { describe, expect, it } from "vitest";
import { fetchGuarded, pinnedLookup } from "@/server/http/fetch-guarded";
import { authorizeUrl, UrlPolicyError } from "@/server/http/ssrf";
import { createPage } from "@/server/services/tasks";
import "./helpers";

const publicDns = async () => [{ address: "8.8.8.8", family: 4 }];

describe("загрузчик страниц", () => {
  it("блокирует внутренние адреса, чужие домены и опасные перенаправления", async () => {
    await expect(authorizeUrl("http://127.0.0.1/admin", { siteOnly: true, resolveHost: publicDns })).rejects.toBeInstanceOf(UrlPolicyError);
    await expect(authorizeUrl("http://localhost/secret", { siteOnly: false, resolveHost: publicDns })).rejects.toBeInstanceOf(UrlPolicyError);
    await expect(authorizeUrl("http://169.254.169.254/latest", { siteOnly: false, resolveHost: publicDns })).rejects.toBeInstanceOf(UrlPolicyError);
    await expect(authorizeUrl("http://10.1.1.1/", { siteOnly: false, resolveHost: publicDns })).rejects.toBeInstanceOf(UrlPolicyError);
    await expect(authorizeUrl("file:///etc/passwd", { siteOnly: false, resolveHost: publicDns })).rejects.toBeInstanceOf(UrlPolicyError);
    await expect(authorizeUrl("https://boat-sochi.ru.evil.com/", { siteOnly: true, resolveHost: publicDns })).rejects.toBeInstanceOf(UrlPolicyError);
    await expect(authorizeUrl("https://example.com/article", { siteOnly: true, resolveHost: publicDns })).rejects.toBeInstanceOf(UrlPolicyError);
    await expect(authorizeUrl("https://user:pass@boat-sochi.ru/", { siteOnly: true, resolveHost: publicDns })).rejects.toBeInstanceOf(UrlPolicyError);
    await expect(
      authorizeUrl("https://boat-sochi.ru/gruppovaja_ribalka", {
        siteOnly: true,
        resolveHost: async () => [{ address: "10.0.0.8", family: 4 }],
      }),
    ).rejects.toBeInstanceOf(UrlPolicyError);

    const calls: string[] = [];
    await expect(
      fetchGuarded("https://boat-sochi.ru/start", {
        siteOnly: true,
        resolveHost: publicDns,
        perform: async (url) => {
          calls.push(url.toString());
          return {
            status: 302,
            finalUrl: url.toString(),
            headers: { location: "http://127.0.0.1/secret" },
            body: Buffer.from(""),
          };
        },
      }),
    ).rejects.toBeInstanceOf(UrlPolicyError);
    expect(calls).toEqual(["https://boat-sochi.ru/start"]);
    const addresses: unknown[] = [];
    pinnedLookup({ address: "8.8.8.8", family: 4 })("boat-sochi.ru", { all: true }, (_error, address) => {
      addresses.push(address);
    });
    expect(addresses).toEqual([[{ address: "8.8.8.8", family: 4 }]]);
    expect(() => createPage({ url: "https://example.com/yacht", title: "Чужой сайт" })).toThrow(/boat-sochi/);
  });
});
