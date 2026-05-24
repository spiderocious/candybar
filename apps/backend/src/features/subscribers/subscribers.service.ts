import type {
  AddChannelInput,
  RegisterSubscriberInput,
  SetOptOutInput,
  Subscriber,
  SubscriberChannel,
  SubscriberWithChannels,
  UpdateSubscriberInput,
} from '@communique/core';

import type { CursorPayload, CursorPage } from '../../lib/cursor.js';
import { NotFoundError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { ok, fail, type ServiceResult } from '../../lib/service-result.js';

import { subscribersRepository } from './subscribers.repository.js';

export const subscribersService = {
  /** Register (idempotent on external_id). Re-registering merges attributes/channels. */
  async register(
    workspaceId: string,
    input: RegisterSubscriberInput,
  ): Promise<ServiceResult<SubscriberWithChannels>> {
    const subscriber = await subscribersRepository.upsert({
      id: newId('subscriber'),
      workspaceId,
      externalId: input.external_id,
      attributes: input.attributes ?? {},
    });

    for (const ch of input.channels ?? []) {
      await subscribersRepository.upsertChannel({
        id: newId('channel'),
        subscriberId: subscriber.id,
        channel: ch.channel,
        address: ch.address,
      });
    }

    return ok(await subscribersRepository.hydrate(workspaceId, subscriber));
  },

  async get(workspaceId: string, id: string): Promise<ServiceResult<SubscriberWithChannels>> {
    const subscriber = await subscribersRepository.findById(workspaceId, id);
    if (!subscriber) return fail(new NotFoundError('Subscriber not found.'));
    return ok(await subscribersRepository.hydrate(workspaceId, subscriber));
  },

  async list(
    workspaceId: string,
    opts: { limit: number; cursor?: CursorPayload; search?: string },
  ): Promise<ServiceResult<CursorPage<Subscriber>>> {
    return ok(await subscribersRepository.list(workspaceId, opts));
  },

  async update(
    workspaceId: string,
    id: string,
    input: UpdateSubscriberInput,
  ): Promise<ServiceResult<SubscriberWithChannels>> {
    const existing = await subscribersRepository.findById(workspaceId, id);
    if (!existing) return fail(new NotFoundError('Subscriber not found.'));
    const merged = { ...existing.attributes, ...(input.attributes ?? {}) };
    const updated = await subscribersRepository.updateAttributes(workspaceId, id, merged);
    if (!updated) return fail(new NotFoundError('Subscriber not found.'));
    return ok(await subscribersRepository.hydrate(workspaceId, updated));
  },

  async remove(workspaceId: string, id: string): Promise<ServiceResult<null>> {
    const deleted = await subscribersRepository.softDelete(workspaceId, id);
    if (!deleted) return fail(new NotFoundError('Subscriber not found.'));
    return ok(null);
  },

  async addChannel(
    workspaceId: string,
    id: string,
    input: AddChannelInput,
  ): Promise<ServiceResult<SubscriberChannel>> {
    const subscriber = await subscribersRepository.findById(workspaceId, id);
    if (!subscriber) return fail(new NotFoundError('Subscriber not found.'));
    const channel = await subscribersRepository.upsertChannel({
      id: newId('channel'),
      subscriberId: subscriber.id,
      channel: input.channel,
      address: input.address,
    });
    return ok(channel);
  },

  async removeChannel(
    workspaceId: string,
    id: string,
    channelId: string,
  ): Promise<ServiceResult<null>> {
    const subscriber = await subscribersRepository.findById(workspaceId, id);
    if (!subscriber) return fail(new NotFoundError('Subscriber not found.'));
    const removed = await subscribersRepository.removeChannel(subscriber.id, channelId);
    if (!removed) return fail(new NotFoundError('Channel not found.'));
    return ok(null);
  },

  async setOptOut(
    workspaceId: string,
    id: string,
    input: SetOptOutInput,
  ): Promise<ServiceResult<SubscriberWithChannels>> {
    const subscriber = await subscribersRepository.findById(workspaceId, id);
    if (!subscriber) return fail(new NotFoundError('Subscriber not found.'));
    await subscribersRepository.setOptOut(subscriber.id, input.channel, input.opted_out);
    return ok(await subscribersRepository.hydrate(workspaceId, subscriber));
  },
};
