import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request context carried through the call stack so services never need to
 * receive `req`. Seeded by request-id middleware; workspace fields added by the
 * api-key auth middleware once the credential is resolved.
 */
export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  workspaceId?: string;
  credentialId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Workspace id of the current request. Throws if called outside an authed request. */
export function requireWorkspaceId(): string {
  const ctx = storage.getStore();
  if (!ctx?.workspaceId) {
    throw new Error('requireWorkspaceId called outside an authenticated request context');
  }
  return ctx.workspaceId;
}

export function setWorkspace(workspaceId: string, credentialId: string): void {
  const ctx = storage.getStore();
  if (ctx) {
    ctx.workspaceId = workspaceId;
    ctx.credentialId = credentialId;
  }
}
