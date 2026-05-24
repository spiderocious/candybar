import type {
  AddAudienceMemberInput,
  Audience,
  CreateAudienceInput,
  UpdateAudienceInput,
} from '@communique/core';

import type { CursorPage, CursorPayload } from '../../lib/cursor.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { ok, fail, type ServiceResult } from '../../lib/service-result.js';
import { subscribersRepository } from '../subscribers/subscribers.repository.js';

import { audiencesRepository } from './audiences.repository.js';

export const audiencesService = {
  async create(
    workspaceId: string,
    input: CreateAudienceInput,
  ): Promise<ServiceResult<Audience>> {
    if (await audiencesRepository.nameExists(workspaceId, input.name)) {
      return fail(new ConflictError(`An audience named "${input.name}" already exists.`));
    }
    const audience = await audiencesRepository.create(
      newId('audience'),
      workspaceId,
      input.name,
      input.description ?? null,
    );
    return ok(audience);
  },

  async get(workspaceId: string, id: string): Promise<ServiceResult<Audience>> {
    const audience = await audiencesRepository.findById(workspaceId, id);
    if (!audience) return fail(new NotFoundError('Audience not found.'));
    return ok(audience);
  },

  async list(
    workspaceId: string,
    opts: { limit: number; cursor?: CursorPayload },
  ): Promise<ServiceResult<CursorPage<Audience>>> {
    return ok(await audiencesRepository.list(workspaceId, opts));
  },

  async update(
    workspaceId: string,
    id: string,
    input: UpdateAudienceInput,
  ): Promise<ServiceResult<Audience>> {
    const updated = await audiencesRepository.update(workspaceId, id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    });
    if (!updated) return fail(new NotFoundError('Audience not found.'));
    return ok(updated);
  },

  async remove(workspaceId: string, id: string): Promise<ServiceResult<null>> {
    const deleted = await audiencesRepository.softDelete(workspaceId, id);
    if (!deleted) return fail(new NotFoundError('Audience not found.'));
    return ok(null);
  },

  async addMember(
    workspaceId: string,
    audienceId: string,
    input: AddAudienceMemberInput,
  ): Promise<ServiceResult<Audience>> {
    const audience = await audiencesRepository.findById(workspaceId, audienceId);
    if (!audience) return fail(new NotFoundError('Audience not found.'));
    const subscriber = await subscribersRepository.findById(workspaceId, input.subscriber_id);
    if (!subscriber) return fail(new NotFoundError('Subscriber not found.'));
    await audiencesRepository.addMember(audienceId, subscriber.id);
    return ok((await audiencesRepository.findById(workspaceId, audienceId))!);
  },

  async removeMember(
    workspaceId: string,
    audienceId: string,
    subscriberId: string,
  ): Promise<ServiceResult<null>> {
    const audience = await audiencesRepository.findById(workspaceId, audienceId);
    if (!audience) return fail(new NotFoundError('Audience not found.'));
    const removed = await audiencesRepository.removeMember(audienceId, subscriberId);
    if (!removed) return fail(new NotFoundError('Subscriber is not a member of this audience.'));
    return ok(null);
  },

  async listMembers(
    workspaceId: string,
    audienceId: string,
    opts: { limit: number; cursor?: CursorPayload },
  ): Promise<ServiceResult<CursorPage<{ subscriber_id: string; external_id: string; joined_at: string }>>> {
    const audience = await audiencesRepository.findById(workspaceId, audienceId);
    if (!audience) return fail(new NotFoundError('Audience not found.'));
    return ok(await audiencesRepository.listMembers(workspaceId, audienceId, opts));
  },
};
