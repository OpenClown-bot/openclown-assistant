export interface AppConfig {
  telegramBotToken: string;
  telegramPilotUserIds: string[];
  databaseUrl: string;
  postgresPassword: string;
  omnirouteBaseUrl: string;
  omnirouteApiKey: string;
  fireworksApiKey: string;
  usdaFdcApiKey: string;
  personaPath: string;
  poAlertChatId: string;
  monthlySpendCeilingUsd: number;
  auditDbUrl: string;
}

export const REQUIRED_CONFIG_NAMES: readonly string[] = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_PILOT_USER_IDS",
  "DATABASE_URL",
  "POSTGRES_PASSWORD",
  "OMNIROUTE_BASE_URL",
  "OMNIROUTE_API_KEY",
  "FIREWORKS_API_KEY",
  "USDA_FDC_API_KEY",
  "PERSONA_PATH",
  "PO_ALERT_CHAT_ID",
  "MONTHLY_SPEND_CEILING_USD",
  "AUDIT_DB_URL",
] as const;

export type RequiredConfigName = (typeof REQUIRED_CONFIG_NAMES)[number];

export class ConfigError extends Error {
  public readonly missingNames: readonly string[];

  constructor(missingNames: readonly string[]);
  constructor(missingNames: readonly string[], message: string);
  constructor(missingNames: readonly string[], message?: string) {
    const fieldList = missingNames.join(", ");
    super(message ?? `Missing required config: ${fieldList}`);
    this.name = "ConfigError";
    this.missingNames = missingNames;
  }
}

export function parseConfig(env: Record<string, string | undefined>): AppConfig {
  const missing: string[] = [];

  for (const name of REQUIRED_CONFIG_NAMES) {
    if (!env[name] || env[name]!.trim() === "") {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    throw new ConfigError(missing);
  }

  return {
    telegramBotToken: env["TELEGRAM_BOT_TOKEN"]!.trim(),
    telegramPilotUserIds: env["TELEGRAM_PILOT_USER_IDS"]!.split(",").map((s) => s.trim()),
    databaseUrl: env["DATABASE_URL"]!.trim(),
    postgresPassword: env["POSTGRES_PASSWORD"]!.trim(),
    omnirouteBaseUrl: env["OMNIROUTE_BASE_URL"]!.trim(),
    omnirouteApiKey: env["OMNIROUTE_API_KEY"]!.trim(),
    fireworksApiKey: env["FIREWORKS_API_KEY"]!.trim(),
    usdaFdcApiKey: env["USDA_FDC_API_KEY"]!.trim(),
    personaPath: env["PERSONA_PATH"]!.trim(),
    poAlertChatId: env["PO_ALERT_CHAT_ID"]!.trim(),
    monthlySpendCeilingUsd: (() => {
      const parsed = parseFloat(env["MONTHLY_SPEND_CEILING_USD"]!.trim());
      if (Number.isNaN(parsed) || parsed <= 0) {
        throw new ConfigError(
          ["MONTHLY_SPEND_CEILING_USD"],
          `Invalid numeric value for MONTHLY_SPEND_CEILING_USD`
        );
      }
      return parsed;
    })(),
    auditDbUrl: env["AUDIT_DB_URL"]!.trim(),
  };
}

export function redactSecrets(input: string, secretNames: readonly string[]): string {
  let result = input;
  for (const name of secretNames) {
    const pattern = new RegExp(escapeRegExp(name) + `=\\S*`, "gi");
    result = result.replace(pattern, `${name}=[REDACTED]`);
  }
  return result;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
