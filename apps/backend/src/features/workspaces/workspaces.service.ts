import type {
  ApiCredential,
  ApiCredentialWithSecret,
  CreateCredentialInput,
  CreateWorkspaceInput,
  Workspace,
} from '@communique/core';

import { generateApiKey } from '../../lib/api-key.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { ok, fail, type ServiceResult } from '../../lib/service-result.js';

import { workspacesRepository } from './workspaces.repository.js';

export interface WorkspaceWithCredential {
  workspace: Workspace;
  credential: ApiCredentialWithSecret;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const workspacesService = {
  /**
   * Creates a workspace and issues an initial API credential in one step (the
   * plaintext key is returned ONCE). This bootstraps a tenant so subsequent
   * credential management can be authenticated with that key.
   */
  async create(input: CreateWorkspaceInput): Promise<ServiceResult<WorkspaceWithCredential>> {
    const slug = input.slug ?? slugify(input.name);
    if (await workspacesRepository.slugExists(slug)) {
      return fail(new ConflictError(`A workspace with slug "${slug}" already exists.`));
    }
    const workspace = await workspacesRepository.createWorkspace(
      newId('workspace'),
      input.name,
      slug,
    );
    const generated = generateApiKey();
    const credential = await workspacesRepository.createCredential({
      id: newId('credential'),
      workspaceId: workspace.id,
      name: 'Default',
      keyHash: generated.keyHash,
      prefix: generated.prefix,
    });
    return ok({ workspace, credential: { ...credential, key: generated.key } });
  },

  async get(id: string): Promise<ServiceResult<Workspace>> {
    const workspace = await workspacesRepository.findWorkspace(id);
    if (!workspace) return fail(new NotFoundError('Workspace not found.'));
    return ok(workspace);
  },

  async issueCredential(
    workspaceId: string,
    input: CreateCredentialInput,
  ): Promise<ServiceResult<ApiCredentialWithSecret>> {
    const workspace = await workspacesRepository.findWorkspace(workspaceId);
    if (!workspace) return fail(new NotFoundError('Workspace not found.'));

    const generated = generateApiKey();
    const credential = await workspacesRepository.createCredential({
      id: newId('credential'),
      workspaceId,
      name: input.name,
      keyHash: generated.keyHash,
      prefix: generated.prefix,
    });
    return ok({ ...credential, key: generated.key });
  },

  async listCredentials(workspaceId: string): Promise<ServiceResult<ApiCredential[]>> {
    return ok(await workspacesRepository.listCredentials(workspaceId));
  },

  async rotateCredential(
    workspaceId: string,
    credentialId: string,
  ): Promise<ServiceResult<ApiCredentialWithSecret>> {
    const existing = await workspacesRepository.findCredential(workspaceId, credentialId);
    if (!existing) return fail(new NotFoundError('Credential not found.'));

    await workspacesRepository.revokeCredential(workspaceId, credentialId);
    const generated = generateApiKey();
    const credential = await workspacesRepository.createCredential({
      id: newId('credential'),
      workspaceId,
      name: `${existing.name} (rotated)`,
      keyHash: generated.keyHash,
      prefix: generated.prefix,
    });
    return ok({ ...credential, key: generated.key });
  },

  async revokeCredential(
    workspaceId: string,
    credentialId: string,
  ): Promise<ServiceResult<null>> {
    const revoked = await workspacesRepository.revokeCredential(workspaceId, credentialId);
    if (!revoked) return fail(new NotFoundError('Credential not found or already revoked.'));
    return ok(null);
  },
};
