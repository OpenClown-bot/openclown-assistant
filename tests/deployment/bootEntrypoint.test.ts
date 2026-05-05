import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { createServer, stopServer, BRIDGE_VERSION } from "../../src/main.js";

const PORT = 32101;

interface FetchResult {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
}

function fetch(opts: {
  path: string;
  method: string;
  body?: unknown;
}): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path: opts.path,
        method: opts.method,
        headers: {
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers as Record<string, string | string[] | undefined>,
            body: data ? (JSON.parse(data) as Record<string, unknown>) : {},
          });
        });
      }
    );
    req.on("error", reject);
    if (opts.body !== undefined) {
      req.write(JSON.stringify(opts.body));
    }
    req.end();
  });
}

describe("bootEntrypoint", () => {
  let server: ReturnType<typeof createServer>;

  beforeAll(async () => {
    process.env.TELEGRAM_PILOT_USER_IDS = "111,222";
    server = createServer({ pilotUserIds: ["111", "222"] });
    await new Promise<void>((resolve) => {
      server.listen(PORT, () => resolve());
    });
  });

  afterAll(async () => {
    await stopServer(server);
  });

  it("GET /kbju/health returns 200 with X-Kbju-Bridge-Version: 1.0 header", async () => {
    const result = await fetch({ path: "/kbju/health", method: "GET" });
    expect(result.status).toBe(200);
    expect(result.headers["x-kbju-bridge-version"]).toBe(BRIDGE_VERSION);
    expect(result.body.status).toBe("ok");
    expect(typeof result.body.uptime_seconds).toBe("number");
  });

  it("POST /kbju/message with missing telegram_id returns 400 and error: invalid_request", async () => {
    const result = await fetch({
      path: "/kbju/message",
      method: "POST",
      body: { text: "hello" },
    });
    expect(result.status).toBe(400);
    expect(result.body.error).toBe("invalid_request");
  });

  it("POST /kbju/message for a blocked Telegram ID returns 403 and error: tenant_not_allowed", async () => {
    const result = await fetch({
      path: "/kbju/message",
      method: "POST",
      body: { telegram_id: 999, text: "hello" },
    });
    expect(result.status).toBe(403);
    expect(result.body.error).toBe("tenant_not_allowed");
    expect(result.body.telegram_id).toBe(999);
  });

  it("valid POST /kbju/message returns 200 and a Russian reply envelope", async () => {
    const result = await fetch({
      path: "/kbju/message",
      method: "POST",
      body: { telegram_id: 111, text: "hello", message_id: 1001, chat_id: 111 },
    });
    expect(result.status).toBe(200);
    expect(typeof result.body.reply_text).toBe("string");
    expect((result.body.reply_text as string).length).toBeGreaterThan(0);
  });

  it("POST /kbju/callback returns 200", async () => {
    const result = await fetch({
      path: "/kbju/callback",
      method: "POST",
      body: {
        callback_data: "confirm_meal:draft123",
        telegram_id: 111,
        message_id: 1002,
      },
    });
    expect(result.status).toBe(200);
    expect(typeof result.body.reply_text).toBe("string");
  });

  it("POST /kbju/cron returns 200 with summary_sent_to array", async () => {
    const result = await fetch({
      path: "/kbju/cron",
      method: "POST",
      body: { trigger: "daily_summary", timezone: "Europe/Moscow" },
    });
    expect(result.status).toBe(200);
    expect(Array.isArray(result.body.summary_sent_to)).toBe(true);
    expect(result.body.skipped_count).toBe(0);
  });

  it("unknown route returns 404", async () => {
    const result = await fetch({ path: "/unknown", method: "GET" });
    expect(result.status).toBe(404);
    expect(result.body.error).toBe("not_found");
  });

  it("GET /kbju/health returns X-Kbju-Bridge-Version: 1.0 header (smoke)", async () => {
    const result = await fetch({ path: "/kbju/health", method: "GET" });
    expect(result.headers["x-kbju-bridge-version"]).toBe("1.0");
  });
});