import type { AuditPublisher } from "../../../domain/audit";
import type { AuthUser } from "../../authentication/model";
import { auditPublisher } from "../../../platform/audit/runtime.server";

export async function recordControlledDictionaryRead(
  user: AuthUser | null,
  publisher: AuditPublisher = auditPublisher,
  correlationId: () => string = () => crypto.randomUUID(),
) {
  if (!user) {
    // React Router uses thrown Responses to stop the protected route.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response(null, { status: 403, statusText: "Forbidden" });
  }

  const result = await publisher.publish({
    delivery: "required",
    event: {
      correlationId: correlationId(),
      actor: { type: "user", id: user.id },
      source: "http",
      action: "dictionary.read",
      target: { type: "application" },
      outcome: "succeeded",
    },
  });

  if (result.status === "unavailable") {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response(null, {
      status: 503,
      statusText: "Service Unavailable",
    });
  }
}
