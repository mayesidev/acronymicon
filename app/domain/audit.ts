export const auditActions = [
  "authentication.login",
  "authentication.logout",
  "authorization.check",
  "acronym.submit",
  "acronym.import",
  "database.migrate",
  "audit.sink.append",
] as const;

export type AuditAction = (typeof auditActions)[number];

export type AuditActor =
  | Readonly<{ type: "anonymous" }>
  | Readonly<{ type: "system" }>
  | Readonly<{ type: "user"; id: string }>;

export type AuditSource = "http" | "maintenance" | "migration";

export type AuditTarget =
  | Readonly<{ type: "application" }>
  | Readonly<{
      type: "acronym-entry" | "identity" | "session";
      id: string;
    }>;

export type AuditOutcome = "succeeded" | "denied" | "failed";

export type AuditEvent = Readonly<{
  schemaVersion: 1;
  timestamp: string;
  correlationId: string;
  actor: AuditActor;
  source: AuditSource;
  action: AuditAction;
  target: AuditTarget;
  outcome: AuditOutcome;
}>;

export type AuditEventInput = Omit<AuditEvent, "schemaVersion" | "timestamp">;

export type AuditDelivery = "required" | "best-effort";

export type AuditPublication = Readonly<{
  delivery: AuditDelivery;
  event: AuditEventInput;
}>;

export type AuditPublicationResult =
  | Readonly<{ status: "recorded" }>
  | Readonly<{ status: "unavailable"; delivery: AuditDelivery }>;

export type AuditSinkResult =
  Readonly<{ status: "recorded" }> | Readonly<{ status: "unavailable" }>;

export interface AuditPublisher {
  publish(publication: AuditPublication): Promise<AuditPublicationResult>;
}

export interface AuditClock {
  now(): Date;
}

export interface AuditSink {
  append(event: AuditEvent): Promise<AuditSinkResult>;
}
