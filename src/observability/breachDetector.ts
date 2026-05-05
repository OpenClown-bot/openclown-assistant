import { createHash } from "node:crypto";

export type BreachOperation = "read" | "write";

export class TenantNotAllowedError extends Error {
  public readonly code = "tenant_not_allowed";
  public readonly requestingUserIdHash: string;
  public readonly dataOwnerUserIdHash: string;
  public readonly operation: BreachOperation;
  public readonly entityType: string;

  constructor(
    requestingUserIdHash: string,
    dataOwnerUserIdHash: string,
    operation: BreachOperation,
    entityType: string
  ) {
    super(
      `tenant_not_allowed: ${operation} on ${entityType} by requester ${requestingUserIdHash}`
    );
    this.name = "TenantNotAllowedError";
    this.requestingUserIdHash = requestingUserIdHash;
    this.dataOwnerUserIdHash = dataOwnerUserIdHash;
    this.operation = operation;
    this.entityType = entityType;
  }
}

export interface RedactedBreachEvent {
  event_name: "kbju_tenant_breach_detected";
  requesting_user_id_hash: string;
  data_owner_user_id_hash: string;
  operation: BreachOperation;
  entity_type: string;
  timestamp_utc: string;
}

export interface BreachDetectorDeps {
  emit: (event: RedactedBreachEvent) => void;
  now: () => Date;
  hashUserId: (id: string) => string;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export class BreachDetector {
  private readonly deps: BreachDetectorDeps;
  private readonly breachTimestamps: number[] = [];

  constructor(deps: BreachDetectorDeps) {
    this.deps = deps;
  }

  public checkTenantAccess(
    requesterUserId: string,
    dataOwnerUserId: string,
    operation: BreachOperation,
    entityType: string
  ): void {
    if (requesterUserId === dataOwnerUserId) {
      return;
    }

    const reqHash = this.deps.hashUserId(requesterUserId);
    const ownerHash = this.deps.hashUserId(dataOwnerUserId);
    const timestamp = this.deps.now().toISOString();

    this.deps.emit({
      event_name: "kbju_tenant_breach_detected",
      requesting_user_id_hash: reqHash,
      data_owner_user_id_hash: ownerHash,
      operation,
      entity_type: entityType,
      timestamp_utc: timestamp,
    });

    this.breachTimestamps.push(this.deps.now().getTime());
    this.pruneBreachTimestamps();

    throw new TenantNotAllowedError(reqHash, ownerHash, operation, entityType);
  }

  private pruneBreachTimestamps(): void {
    const nowMs = this.deps.now().getTime();
    const cutoff = nowMs - ONE_HOUR_MS;
    let writeIdx = 0;
    for (let i = 0; i < this.breachTimestamps.length; i++) {
      if (this.breachTimestamps[i] >= cutoff) {
        this.breachTimestamps[writeIdx] = this.breachTimestamps[i];
        writeIdx++;
      }
    }
    this.breachTimestamps.length = writeIdx;
  }

  public getBreachCountLastHour(): number {
    this.pruneBreachTimestamps();
    return this.breachTimestamps.length;
  }
}

export function sha256Half(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 16);
}
