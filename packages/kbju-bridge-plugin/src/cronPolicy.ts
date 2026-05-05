export const CRON_RESTRICTED_TOOLS = ["kbju_cron"] as const;
export type CronRestrictedTool = (typeof CRON_RESTRICTED_TOOLS)[number];

export function isCronAllowed(toolName: string): boolean {
  return CRON_RESTRICTED_TOOLS.includes(toolName as CronRestrictedTool);
}

export function assertCronAllowed(toolName: string): void {
  if (!isCronAllowed(toolName)) {
    throw new Error(
      `Tool "${toolName}" is not allowed in cron restricted context. Only kbju_cron is permitted.`
    );
  }
}

export function createCronFilter(): (name: string) => boolean {
  return (name) => isCronAllowed(name);
}