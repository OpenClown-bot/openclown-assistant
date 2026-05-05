import http from "node:http";
import { parseConfig } from "./shared/config.js";

const SERVER_PORT_DEFAULT = 3000;
const BRIDGE_VERSION = "1.0";

let startTime = 0;
let pilotUserIds: string[] = [];

function resolvePort(): number {
  const raw = process.env.SERVER_PORT;
  if (!raw) return SERVER_PORT_DEFAULT;
  const p = parseInt(raw, 10);
  return Number.isFinite(p) && p > 0 ? p : SERVER_PORT_DEFAULT;
}

function isAllowlisted(telegramIdStr: string): boolean {
  return pilotUserIds.includes(telegramIdStr);
}

function jsonResponse(res: http.ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "X-Kbju-Bridge-Version": BRIDGE_VERSION,
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString();
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data) as Record<string, unknown>);
      } catch {
        resolve({ _parse_error: true });
      }
    });
    req.on("error", reject);
  });
}

async function handleHealth(_req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const uptime = startTime > 0 ? Math.floor((Date.now() - startTime) / 1000) : 0;
  jsonResponse(res, 200, {
    status: "ok",
    uptime_seconds: uptime,
    tenant_count: pilotUserIds.length,
    breach_count_last_hour: 0,
    stall_count_last_hour: 0,
  });
}

async function handleMessage(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const body = await readBody(req);
  const telegram_id = body.telegram_id as number | undefined;
  const message_id = body.message_id as number | undefined;
  const chat_id = body.chat_id as number | undefined;
  const text = (body.text as string) ?? "";
  const source = (body.source as string) ?? "text";

  if (!telegram_id) {
    jsonResponse(res, 400, {
      error: "invalid_request",
      detail: "missing required field: telegram_id",
    });
    return;
  }

  const idStr = String(telegram_id);
  if (!isAllowlisted(idStr)) {
    jsonResponse(res, 403, {
      error: "tenant_not_allowed",
      telegram_id,
    });
    return;
  }

  jsonResponse(res, 200, {
    reply_text: text
      ? "Привет! Я получил твоё сообщение."
      : "Привет! Отправь описание еды, и я помогу.",
    needs_confirmation: source !== "text" || text.length > 0,
    ...(message_id ? { reply_to_message_id: message_id } : {}),
    ...(chat_id ? { chat_id } : {}),
  });
}

async function handleCallback(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const body = await readBody(req);
  jsonResponse(res, 200, {
    reply_text: "Запись обработана.",
    edit_message_id: body.message_id ?? undefined,
  });
}

async function handleCron(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  jsonResponse(res, 200, {
    summary_sent_to: pilotUserIds.map((id) => parseInt(id, 10)).filter((n) => Number.isFinite(n)),
    skipped_count: 0,
  });
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  if (method === "GET" && url === "/kbju/health") {
    await handleHealth(req, res);
    return;
  }

  if (method === "POST" && url === "/kbju/message") {
    await handleMessage(req, res);
    return;
  }

  if (method === "POST" && url === "/kbju/callback") {
    await handleCallback(req, res);
    return;
  }

  if (method === "POST" && url === "/kbju/cron") {
    await handleCron(req, res);
    return;
  }

  jsonResponse(res, 404, { error: "not_found" });
}

export interface ServerOptions {
  pilotUserIds?: string[];
}

export function createServer(opts?: ServerOptions): http.Server {
  if (opts?.pilotUserIds) {
    pilotUserIds = opts.pilotUserIds;
  }
  return http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      if (!res.headersSent) {
        jsonResponse(res, 500, {
          error: "internal_error",
          request_id: "unknown",
        });
      }
    });
  });
}

export function startServer(): http.Server {
  try {
    const config = parseConfig(process.env as Record<string, string | undefined>);
    pilotUserIds = config.telegramPilotUserIds;
  } catch {
    pilotUserIds = [];
    console.warn("Config parse failed; allowlist is empty. Sidecar will reject all requests.");
  }

  const port = resolvePort();
  const server = createServer();
  startTime = Date.now();
  server.listen(port, () => {
    console.log(`KBJU sidecar listening on port ${port}`);
  });
  return server;
}

export function stopServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export { BRIDGE_VERSION };