import { expect } from "vitest";

import type {
  AuditPublication,
  AuditPublicationResult,
  AuditPublisher,
} from "../../app/domain/audit";

export class AuditRecorder implements AuditPublisher {
  readonly #attempts: AuditPublication[] = [];
  #available: boolean;

  constructor(options: { available?: boolean } = {}) {
    this.#available = options.available ?? true;
  }

  get attempts(): readonly AuditPublication[] {
    return [...this.#attempts];
  }

  setAvailable(available: boolean) {
    this.#available = available;
  }

  publish(publication: AuditPublication): Promise<AuditPublicationResult> {
    this.#attempts.push(publication);

    return Promise.resolve(
      this.#available
        ? { status: "recorded" }
        : { status: "unavailable", delivery: publication.delivery },
    );
  }
}

export function expectAuditAttempts(
  recorder: AuditRecorder,
  expected: readonly AuditPublication[],
) {
  expect(recorder.attempts).toEqual(expected);
}
