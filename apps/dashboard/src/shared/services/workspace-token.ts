/**
 * Holds the workspace API key in memory (never localStorage — see security
 * guidance). On a hard refresh the user re-enters the key on the connect screen.
 */
let token: string | null = null;

export const workspaceToken = {
  set(value: string): void {
    token = value;
  },
  get(): string | null {
    return token;
  },
  clear(): void {
    token = null;
  },
  has(): boolean {
    return token !== null;
  },
};
