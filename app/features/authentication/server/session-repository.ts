export type StoredSessionData = Record<string, unknown>;

export interface SessionRepository {
  create(data: StoredSessionData, expiresAt: Date): Promise<string>;
  read(id: string): Promise<StoredSessionData | null>;
  update(id: string, data: StoredSessionData, expiresAt: Date): Promise<void>;
  delete(id: string): Promise<void>;
}
