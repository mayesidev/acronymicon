import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createCookie } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPersistentSessionSecretResolver } from "./session-secret.server";

const directories: string[] = [];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "acronymicon-secret-"));
  directories.push(root);
  const directory = join(root, ".acronymicon");
  return {
    root,
    directory,
    path: join(directory, "session-secret"),
    database: join(root, "app.sqlite"),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("persistent session secret", () => {
  it("creates a private random key beside the database, reuses it on restart, and preserves cookies", async () => {
    const { database, directory, path } = fixture();
    writeFileSync(database, "existing database");
    const first = createPersistentSessionSecretResolver()(database);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(readFileSync(path, "utf8")).toBe(`${first}\n`);
    expect(lstatSync(directory).mode & 0o7777).toBe(0o700);
    expect(lstatSync(path).mode & 0o7777).toBe(0o600);
    expect(lstatSync(path).uid).toBe(process.getuid?.());
    const cookie = await createCookie("session", {
      secrets: [first],
    }).serialize("session-id");

    const restarted = createPersistentSessionSecretResolver()(database);
    expect(restarted).toBe(first);
    expect(
      await createCookie("session", { secrets: [restarted] }).parse(cookie),
    ).toBe("session-id");
    expect(readFileSync(database, "utf8")).toBe("existing database");
  });

  it("caches per data directory and keeps separate volumes independent", () => {
    const first = fixture();
    const second = fixture();
    const resolveSecret = createPersistentSessionSecretResolver();
    const secret = resolveSecret(first.database);
    expect(resolveSecret(join(first.root, "other.sqlite"))).toBe(secret);
    expect(resolveSecret(second.database)).not.toBe(secret);
    writeFileSync(first.path, "corrupt");
    expect(resolveSecret(first.database)).toBe(secret);
    expect(() =>
      createPersistentSessionSecretResolver()(first.database),
    ).toThrow("Restore an invalid key from backup");
  });

  it("publishes one complete key across simultaneous processes without leaving temporary files", async () => {
    const { database, directory } = fixture();
    const moduleUrl = new URL("./session-secret.server.ts", import.meta.url)
      .href;
    const script = `
      import { createHash } from 'node:crypto';
      const { createPersistentSessionSecretResolver } = await import(${JSON.stringify(moduleUrl)});
      const secret = createPersistentSessionSecretResolver()(process.argv[1]);
      process.stdout.write(createHash('sha256').update(secret).digest('hex'));
    `;
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        promisify(execFile)(process.execPath, [
          "--input-type=module",
          "--eval",
          script,
          database,
        ]),
      ),
    );
    const expected = createHash("sha256")
      .update(createPersistentSessionSecretResolver()(database))
      .digest("hex");
    expect(results.map((result) => result.stdout)).toEqual(
      Array(8).fill(expected),
    );
    expect(readdirSync(directory)).toEqual(["session-secret"]);
  });

  it.each([
    "",
    "too short",
    "g".repeat(64),
    "a".repeat(66),
    `${"a".repeat(64)}\n\n`,
  ])(
    "rejects corrupt keys without replacing them or including them in errors",
    (contents) => {
      const { database, directory, path } = fixture();
      mkdirSync(directory, { mode: 0o700 });
      writeFileSync(path, contents, { mode: 0o600 });
      let error: unknown;
      try {
        createPersistentSessionSecretResolver()(database);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).toContain(
        "Cannot load the persistent session secret",
      );
      if (contents) expect(String(error)).not.toContain(contents);
      expect(readFileSync(path, "utf8")).toBe(contents);
    },
  );

  it.each([
    "directory symlink",
    "file symlink",
    "directory as file",
    "public directory",
    "public file",
    "different owner",
  ])("rejects an unsafe storage boundary: %s", (boundary) => {
    const { root, database, directory, path } = fixture();
    const target = join(root, "target");
    mkdirSync(target, { mode: 0o700 });
    if (boundary === "directory symlink") {
      symlinkSync(target, directory);
    } else {
      mkdirSync(directory, { mode: 0o700 });
      if (boundary === "file symlink") {
        writeFileSync(join(target, "key"), "a".repeat(64), { mode: 0o600 });
        symlinkSync(join(target, "key"), path);
      } else if (boundary === "directory as file") {
        mkdirSync(path, { mode: 0o600 });
      } else {
        writeFileSync(path, "a".repeat(64), { mode: 0o600 });
        if (boundary === "public directory") chmodSync(directory, 0o755);
        if (boundary === "public file") chmodSync(path, 0o644);
        if (boundary === "different owner")
          vi.spyOn(process, "getuid").mockReturnValue(
            lstatSync(directory).uid + 1,
          );
      }
    }
    expect(() => createPersistentSessionSecretResolver()(database)).toThrow(
      "0700/0600",
    );
  });

  it("fails closed when the data directory cannot be created", () => {
    const { root } = fixture();
    const parent = join(root, "not-a-directory");
    writeFileSync(parent, "file");
    expect(() =>
      createPersistentSessionSecretResolver()(join(parent, "app.sqlite")),
    ).toThrow("Ensure the data directory is writable");
  });
});
