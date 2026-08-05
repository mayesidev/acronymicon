export type AuthUser = {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  groups: string[];
};
