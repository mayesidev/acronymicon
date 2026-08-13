import type {
  AuditEvent,
  AuditSink,
  AuditSinkResult,
} from "../../domain/audit";

export type AuditLineWriter = (line: string) => Promise<void>;

export type StandardOutput = Readonly<{
  write(line: string, callback: (error?: Error | null) => void): boolean;
}>;

export function createJsonLineAuditSink(writeLine: AuditLineWriter): AuditSink {
  let pendingWrite = Promise.resolve();

  return {
    async append(event: AuditEvent): Promise<AuditSinkResult> {
      try {
        const line = `${JSON.stringify(event)}\n`;
        const write = pendingWrite.then(() => writeLine(line));
        pendingWrite = write.catch(() => undefined);
        await write;

        return { status: "recorded" };
      } catch {
        return { status: "unavailable" };
      }
    },
  };
}

export function createStandardOutputAuditSink(
  output: StandardOutput = process.stdout,
): AuditSink {
  return createJsonLineAuditSink(
    (line) =>
      new Promise<void>((resolve, reject) => {
        output.write(line, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  );
}
