---
id: TKT-017
title: "G1 Tenant isolation breach detector"
version: 0.1.0
status: draft
arch_ref: ARCH-001@0.5.0
prd_ref: PRD-002@0.2.1
author_model: "deepseek-v4-pro"
assigned_executor: "deepseek-v4-pro"
created: 2026-05-04
updated: 2026-05-04
---

# TKT-017: G1 Tenant isolation breach detector (C12)

## Scope

PRD-002@0.2.1 §2 G1 requires continuous tenant-isolation monitoring (currently verified only via
end-of-pilot audit). This ticket builds C12, the breach detection layer running inside the KBJU
sidecar that validates every cross-tenant data access at runtime.

## Acceptance Criteria

1. `src/observability/breachDetector.ts` exists with `BreachDetector` class:
   - Intercepts every data-access event by wrapping `TenantStore` methods
   - Validates `requester_user_id === row_user_id` for all read/write operations
   - On mismatch: emits `kbju_tenant_breach_detected` metric, logs structured breach event,
     returns `tenant_not_allowed` 403 via HTTP bridge

2. Metric: `kbju_tenant_breach_detected{requester, target, operation}` — counter,
   emitted in `observability/events.ts`

3. Breach event log schema:
   ```json
   {
     "event": "tenant_breach",
     "requester_telegram_id": 123,
     "target_user_id": "uuid",
     "operation": "read_meal_history",
     "timestamp": "ISO-8601"
   }
   ```

4. `GET /kbju/health` response includes `breach_count_last_hour: N`

5. No runtime breach should be possible — every C12 detection is a bug alarm

## Implementation Notes

- Wrap C3 `TenantStore` methods with Proxy-based interception — no source-modification of tenant store
- If no `PO_ALERT_CHAT_ID` is set, log breach to stderr only
- Breach events are NOT forwarded via Telegram (avoid amplification) — logged + metered only
- Unit tests MUST cover: same-tenant read (passes), cross-tenant read (breach fired), cross-tenant
  write (breach fired)