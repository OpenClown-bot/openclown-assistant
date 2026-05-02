import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(import.meta.dirname, "../..");

let FAKE_BIN: string;
let TMP_DIR: string;

function createFakeBinDir(): string {
  TMP_DIR = mkdtempSync(join(tmpdir(), "kbju-test-"));
  const binDir = join(TMP_DIR, "bin");
  mkdirSync(binDir);
  return binDir;
}

function writeFakeGit(binDir: string, diffExitCode: number, logExitCode: number, fetchExitCode: number): void {
  const script = `#!/bin/sh
case "$1" in
  diff) exit ${diffExitCode} ;;
  log) exit ${logExitCode} ;;
  fetch) exit ${fetchExitCode} ;;
  checkout) exit 0 ;;
  *) exit 0 ;;
esac
`;
  writeFileSync(join(binDir, "git"), script, { mode: 0o755 });
}

function writeFakeCommand(binDir: string, name: string, exitCode: number): void {
  const script = `#!/bin/sh\nexit ${exitCode}\n`;
  writeFileSync(join(binDir, name), script, { mode: 0o755 });
}

function writeFakeCurl(binDir: string, exitCode: number, stdout: string): void {
  const outPath = join(TMP_DIR, "curl-output.txt");
  writeFileSync(outPath, stdout, "utf-8");
  const script = `#!/bin/sh\ncat '${outPath}'\nexit ${exitCode}\n`;
  writeFileSync(join(binDir, "curl"), script, { mode: 0o755 });
}

function runScript(
  scriptPath: string,
  args: string[],
  env: Record<string, string>
): { exitCode: number; stdout: string; stderr: string } {
  const mergedEnv = {
    ...process.env,
    PATH: `${FAKE_BIN}:${process.env.PATH}`,
    ...env,
  } as Record<string, string>;
  const result = spawnSync("bash", [scriptPath, ...args], {
    env: mergedEnv,
    encoding: "utf-8",
    timeout: 15000,
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("scripts/rollback-kbju.sh", () => {
  beforeEach(() => {
    FAKE_BIN = createFakeBinDir();
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("aborts with non-zero exit when health checks fail (curl returns error)", () => {
    writeFakeCommand(FAKE_BIN, "docker", 0);
    writeFakeGit(FAKE_BIN, 0, 0, 0);
    writeFakeCommand(FAKE_BIN, "df", 0);
    writeFakeCommand(FAKE_BIN, "date", 0);
    writeFakeCurl(FAKE_BIN, 1, "");

    const result = runScript(
      join(ROOT, "scripts/rollback-kbju.sh"),
      ["abc123"],
      {
        POSTGRES_USER: "test",
        POSTGRES_DB: "test",
        TELEGRAM_BOT_TOKEN: "fake-token",
        PO_ALERT_CHAT_ID: "123",
        ROLLBACK_HEALTH_RETRIES: "2",
      }
    );

    expect(result.exitCode).not.toBe(0);
  }, 20000);

  it("aborts with non-zero exit when working tree has uncommitted changes", () => {
    writeFakeCommand(FAKE_BIN, "docker", 0);
    writeFakeGit(FAKE_BIN, 1, 0, 0);
    writeFakeCommand(FAKE_BIN, "df", 0);
    writeFakeCommand(FAKE_BIN, "date", 0);
    writeFakeCurl(FAKE_BIN, 0, "");

    const result = runScript(
      join(ROOT, "scripts/rollback-kbju.sh"),
      ["abc123"],
      {
        POSTGRES_USER: "test",
        POSTGRES_DB: "test",
        TELEGRAM_BOT_TOKEN: "fake-token",
        PO_ALERT_CHAT_ID: "123",
      }
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("uncommitted changes");
  });

  it("requires exactly one argument", () => {
    const result = runScript(
      join(ROOT, "scripts/rollback-kbju.sh"),
      [],
      {
        POSTGRES_USER: "test",
        POSTGRES_DB: "test",
        TELEGRAM_BOT_TOKEN: "fake-token",
        PO_ALERT_CHAT_ID: "123",
      }
    );
    expect(result.exitCode).toBe(64);
  });

  it("aborts when required env vars are missing", () => {
    writeFakeCommand(FAKE_BIN, "docker", 0);
    writeFakeGit(FAKE_BIN, 0, 0, 0);
    writeFakeCommand(FAKE_BIN, "df", 0);
    writeFakeCommand(FAKE_BIN, "date", 0);

    const result = runScript(
      join(ROOT, "scripts/rollback-kbju.sh"),
      ["abc123"],
      {}
    );

    expect(result.exitCode).not.toBe(0);
  });
});

describe("scripts/migrate-vps-kbju.sh", () => {
  beforeEach(() => {
    FAKE_BIN = createFakeBinDir();
  });

  afterEach(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("fails fast when getWebhookInfo reports last_error_date", () => {
    writeFakeCommand(FAKE_BIN, "docker", 0);
    writeFakeCommand(FAKE_BIN, "ssh", 0);
    writeFakeCommand(FAKE_BIN, "scp", 0);
    writeFakeCommand(FAKE_BIN, "date", 0);
    writeFakeCommand(FAKE_BIN, "mkdir", 0);
    writeFakeCommand(FAKE_BIN, "df", 0);

    const webhookInfoWithError = JSON.stringify({
      ok: true,
      result: {
        url: "https://new.example.com/webhook",
        last_error_date: 1700000000,
        last_error_message: "Connection timeout",
      },
    });

    writeFakeCurl(FAKE_BIN, 0, webhookInfoWithError);

    const result = runScript(
      join(ROOT, "scripts/migrate-vps-kbju.sh"),
      ["new-vps", "https://new.example.com/webhook"],
      {
        POSTGRES_USER: "test",
        POSTGRES_DB: "test",
        TELEGRAM_BOT_TOKEN: "fake-token",
      }
    );

    expect(result.exitCode).not.toBe(0);
    const output = result.stderr + result.stdout;
    expect(output).toContain("last_error_date");
  });

  it("fails fast when getWebhookInfo url does not match new webhook URL", () => {
    writeFakeCommand(FAKE_BIN, "docker", 0);
    writeFakeCommand(FAKE_BIN, "ssh", 0);
    writeFakeCommand(FAKE_BIN, "scp", 0);
    writeFakeCommand(FAKE_BIN, "date", 0);
    writeFakeCommand(FAKE_BIN, "mkdir", 0);
    writeFakeCommand(FAKE_BIN, "df", 0);

    const webhookInfoWrongUrl = JSON.stringify({
      ok: true,
      result: {
        url: "https://old.example.com/webhook",
        last_error_date: null,
      },
    });

    writeFakeCurl(FAKE_BIN, 0, webhookInfoWrongUrl);

    const result = runScript(
      join(ROOT, "scripts/migrate-vps-kbju.sh"),
      ["new-vps", "https://new.example.com/webhook"],
      {
        POSTGRES_USER: "test",
        POSTGRES_DB: "test",
        TELEGRAM_BOT_TOKEN: "fake-token",
      }
    );

    expect(result.exitCode).not.toBe(0);
  });

  it("succeeds when getWebhookInfo returns matching url with null last_error_date", () => {
    writeFakeCommand(FAKE_BIN, "docker", 0);
    writeFakeCommand(FAKE_BIN, "ssh", 0);
    writeFakeCommand(FAKE_BIN, "scp", 0);
    writeFakeCommand(FAKE_BIN, "date", 0);
    writeFakeCommand(FAKE_BIN, "mkdir", 0);
    writeFakeCommand(FAKE_BIN, "df", 0);

    const webhookInfoOk = JSON.stringify({
      ok: true,
      result: {
        url: "https://new.example.com/webhook",
        last_error_date: null,
      },
    });

    writeFakeCurl(FAKE_BIN, 0, webhookInfoOk);

    const result = runScript(
      join(ROOT, "scripts/migrate-vps-kbju.sh"),
      ["new-vps", "https://new.example.com/webhook"],
      {
        POSTGRES_USER: "test",
        POSTGRES_DB: "test",
        TELEGRAM_BOT_TOKEN: "fake-token",
      }
    );

    expect(result.exitCode).toBe(0);
  });

  it("requires exactly two arguments", () => {
    const result = runScript(
      join(ROOT, "scripts/migrate-vps-kbju.sh"),
      [],
      {}
    );
    expect(result.exitCode).toBe(64);
  });

  it("handles formatted JSON with whitespace in getWebhookInfo", () => {
    writeFakeCommand(FAKE_BIN, "docker", 0);
    writeFakeCommand(FAKE_BIN, "ssh", 0);
    writeFakeCommand(FAKE_BIN, "scp", 0);
    writeFakeCommand(FAKE_BIN, "date", 0);
    writeFakeCommand(FAKE_BIN, "mkdir", 0);
    writeFakeCommand(FAKE_BIN, "df", 0);

    const webhookInfoFormatted = JSON.stringify(
      {
        ok: true,
        result: {
          url: "https://new.example.com/webhook",
          last_error_date: null,
        },
      },
      null,
      2
    );

    writeFakeCurl(FAKE_BIN, 0, webhookInfoFormatted);

    const result = runScript(
      join(ROOT, "scripts/migrate-vps-kbju.sh"),
      ["new-vps", "https://new.example.com/webhook"],
      {
        POSTGRES_USER: "test",
        POSTGRES_DB: "test",
        TELEGRAM_BOT_TOKEN: "fake-token",
      }
    );

    expect(result.exitCode).toBe(0);
  });
});
