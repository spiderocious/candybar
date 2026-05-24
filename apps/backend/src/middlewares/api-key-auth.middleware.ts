import { createHash } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { pool } from '../lib/db.js';
import { UnauthenticatedError } from '../lib/errors.js';
import { setWorkspace } from '../lib/request-context.js';

interface CredentialRow {
  id: string;
  workspace_id: string;
}

/** SHA-256 of the presented key; we look up by hash so raw keys are never stored. */
function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Resolves `Authorization: Bearer <key>` to a workspace and seeds the request
 * context. Every workspace-scoped route mounts this. Updates last_used_at.
 */
export async function apiKeyAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthenticatedError();
  }
  const raw = header.slice('Bearer '.length).trim();
  if (!raw) throw new UnauthenticatedError();

  const result = await pool.query<CredentialRow>(
    `SELECT id, workspace_id
       FROM api_credentials
      WHERE key_hash = $1 AND revoked_at IS NULL
      LIMIT 1`,
    [hashKey(raw)],
  );

  const cred = result.rows[0];
  if (!cred) throw new UnauthenticatedError();

  setWorkspace(cred.workspace_id, cred.id);
  // Best-effort last-used update; never blocks the request.
  void pool.query(`UPDATE api_credentials SET last_used_at = now() WHERE id = $1`, [cred.id]);
  next();
}

export { hashKey };
