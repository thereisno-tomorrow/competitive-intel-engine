import type { Transport } from "./connector";

const DEFAULT_HEADERS = {
  "User-Agent":
    "competitive-war-room/1.0 (+https://finmo-intel-warroom.nicwoo.com; contact ops)",
  Accept: "text/html,application/json,application/xhtml+xml,*/*",
};

/** The production fetch-based transport. Throws on non-2xx so the connector can isolate it. */
export const httpTransport: Transport = {
  async getText(url, init) {
    const res = await fetch(url, { ...init, headers: { ...DEFAULT_HEADERS, ...init?.headers } });
    if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
    return res.text();
  },
  async getJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { ...init, headers: { ...DEFAULT_HEADERS, ...init?.headers } });
    if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  },
};
