import { randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

/** Cache by data directory; a new process reads the persisted key again. */
export function createPersistentSessionSecretResolver() {
  const secrets = new Map<string, string>();

  return (databasePath: string): string => {
    const directory = join(dirname(resolve(databasePath)), ".acronymicon");
    const cached = secrets.get(directory);
    if (cached !== undefined) return cached;

    const path = join(directory, "session-secret");
    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const directoryStat = lstatSync(directory);
      if (!directoryStat.isDirectory()) {
        throw new Error(
          "The secret directory must be a directory, not a symlink.",
        );
      }
      assertPrivatePermissions(directoryStat, 0o700);

      let secret = readSecret(path);
      if (secret === undefined) {
        publishSecret(directory, path);
        secret = readSecret(path);
        if (secret === undefined)
          throw new Error("The saved secret is missing.");
      }
      secrets.set(directory, secret);
      return secret;
    } catch (error) {
      throw new Error(
        `Cannot load the persistent session secret at ${path}. Ensure the data directory is writable and the secret directory/file are owned by the app user with permissions 0700/0600. Restore an invalid key from backup or supply SESSION_SECRET.`,
        { cause: error },
      );
    }
  };
}

function assertPrivatePermissions(
  stat: { uid: number; mode: number },
  mode: number,
) {
  if (
    (process.getuid !== undefined && stat.uid !== process.getuid()) ||
    (stat.mode & 0o7777) !== mode
  ) {
    throw new Error("Unsafe session secret ownership or permissions.");
  }
}

function readSecret(path: string): string | undefined {
  let descriptor: number;
  try {
    // Refuse symlinks and avoid blocking if the path is replaced by a FIFO.
    descriptor = openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
  } catch (error) {
    if (hasCode(error, "ENOENT")) return undefined;
    throw error;
  }

  try {
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.size < 64 || stat.size > 65) {
      throw new Error(
        "The saved session secret must be a 32-byte hexadecimal key.",
      );
    }
    assertPrivatePermissions(stat, 0o600);
    const buffer = Buffer.alloc(66);
    const contents = buffer
      .subarray(0, readSync(descriptor, buffer))
      .toString("utf8");
    if (contents.length > 65 || !/^[a-f0-9]{64}\n?$/.test(contents)) {
      throw new Error(
        "The saved session secret must be a 32-byte hexadecimal key.",
      );
    }
    return contents.trimEnd();
  } finally {
    closeSync(descriptor);
  }
}

function publishSecret(directory: string, path: string) {
  const temporaryPath = join(
    directory,
    `.session-secret-${randomBytes(16).toString("hex")}`,
  );
  const descriptor = openSync(temporaryPath, "wx", 0o600);
  try {
    try {
      writeFileSync(descriptor, `${randomBytes(32).toString("hex")}\n`, "utf8");
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }

    try {
      // Publish a complete file without replacing another process's key.
      linkSync(temporaryPath, path);
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
    }
  } finally {
    unlinkSync(temporaryPath);
  }

  const directoryDescriptor = openSync(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    fsyncSync(directoryDescriptor);
  } finally {
    closeSync(directoryDescriptor);
  }
}

function hasCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}
