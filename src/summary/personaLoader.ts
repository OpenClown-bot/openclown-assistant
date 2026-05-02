import { readFileSync } from "node:fs";
import type { OpenClawLogger } from "../shared/types.js";

let cachedPersona: string | null = null;

export function loadPersona(personaPath: string, logger: OpenClawLogger): string {
  if (cachedPersona !== null) {
    return cachedPersona;
  }
  try {
    const content = readFileSync(personaPath, "utf-8");
    if (!content || content.trim().length === 0) {
      throw new Error(`PERSONA_PATH file is empty: ${personaPath}`);
    }
    cachedPersona = content;
    logger.info("summary_persona_loaded", { persona_path: personaPath });
    return cachedPersona;
  } catch (err: unknown) {
    cachedPersona = null;
    const message = err instanceof Error ? err.message : String(err);
    logger.critical("summary_persona_load_failed", { persona_path: personaPath, error: message });
    throw new Error(`C9 startup failed: cannot load PERSONA_PATH="${personaPath}": ${message}`);
  }
}

export function resetPersonaCache(): void {
  cachedPersona = null;
}
