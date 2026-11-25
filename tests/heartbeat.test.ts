/**
 * 測試：heartbeat 模組
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  pingHeartbeat,
  startHeartbeat,
  stopHeartbeat,
} from "../src/utils/heartbeat.js";

describe("heartbeat 心跳檢測模組測試", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stopHeartbeat();
  });

  afterEach(() => {
    stopHeartbeat();
    vi.unstubAllGlobals();
  });

  it("未提供 URL 時應回傳 false", async () => {
    const ok = await pingHeartbeat("success", "");
    expect(ok).toBe(false);
  });

  it("正常 pingHeartbeat('success') 應向主網址發送 POST 請求", async () => {
    let requestedUrl = "";
    let requestBody: Record<string, unknown> = {};

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, opts: any) => {
        requestedUrl = url;
        requestBody = JSON.parse(opts.body);
        return { ok: true, status: 200 } as any;
      })
    );

    const ok = await pingHeartbeat("success", "https://hc-ping.com/test-uuid");
    expect(ok).toBe(true);
    expect(requestedUrl).toBe("https://hc-ping.com/test-uuid");
    expect(requestBody.status).toBe("success");
    expect(requestBody.timestamp).toBeDefined();
  });

  it("pingHeartbeat('fail') 應附加 /fail 子路徑", async () => {
    let requestedUrl = "";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        requestedUrl = url;
        return { ok: true, status: 200 } as any;
      })
    );

    const ok = await pingHeartbeat("fail", "https://hc-ping.com/test-uuid/");
    expect(ok).toBe(true);
    expect(requestedUrl).toBe("https://hc-ping.com/test-uuid/fail");
  });

  it("網路連線錯誤時應回傳 false 且不崩潰", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Network offline");
      })
    );

    const ok = await pingHeartbeat("success", "https://hc-ping.com/test-uuid");
    expect(ok).toBe(false);
  });

  it("startHeartbeat 能正常啟動與 stopHeartbeat 停止", () => {
    const fetchMock = vi.fn(async () => ({ ok: true } as any));
    vi.stubGlobal("fetch", fetchMock);

    startHeartbeat({
      url: "https://hc-ping.com/test-uuid",
      intervalMs: 1000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    stopHeartbeat();
  });
});
