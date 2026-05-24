import {
  CHANNEL_PROVIDERS,
  type CreateProviderInput,
  type Provider,
  type UpdateProviderInput,
} from '@communique/core';

import { encryptJson } from '../../lib/encryption.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { ok, fail, type ServiceResult } from '../../lib/service-result.js';
import { getProvider } from '../../providers/registry.js';

import { providersRepository } from './providers.repository.js';

export const providersService = {
  async create(workspaceId: string, input: CreateProviderInput): Promise<ServiceResult<Provider>> {
    // The provider key must be valid for the channel.
    if (!CHANNEL_PROVIDERS[input.channel].includes(input.provider_key)) {
      return fail(
        new ValidationError(
          `Provider "${input.provider_key}" is not available for channel "${input.channel}".`,
          'provider_key',
        ),
      );
    }

    // Validate the supplied config against the provider's own schema.
    const provider = getProvider(input.channel, input.provider_key);
    if (!provider) return fail(new NotFoundError('Provider implementation not found.'));
    let config: unknown;
    try {
      config = provider.validateConfig(input.config);
    } catch (err) {
      return fail(
        new ValidationError(
          err instanceof Error ? `Invalid provider config: ${err.message}` : 'Invalid provider config.',
          'config',
        ),
      );
    }

    const priority =
      input.priority ?? (await providersRepository.nextPriority(workspaceId, input.channel));
    if (await providersRepository.priorityTaken(workspaceId, input.channel, priority)) {
      return fail(
        new ConflictError(`Priority ${priority} is already used for channel "${input.channel}".`),
      );
    }

    const created = await providersRepository.create({
      id: newId('provider'),
      workspaceId,
      channel: input.channel,
      providerKey: input.provider_key,
      priority,
      enabled: input.enabled ?? true,
      configEncrypted: encryptJson(config),
    });
    return ok(created);
  },

  async list(workspaceId: string): Promise<ServiceResult<Provider[]>> {
    return ok(await providersRepository.list(workspaceId));
  },

  async get(workspaceId: string, id: string): Promise<ServiceResult<Provider>> {
    const provider = await providersRepository.findById(workspaceId, id);
    if (!provider) return fail(new NotFoundError('Provider not found.'));
    return ok(provider);
  },

  async update(
    workspaceId: string,
    id: string,
    input: UpdateProviderInput,
  ): Promise<ServiceResult<Provider>> {
    const existing = await providersRepository.findById(workspaceId, id);
    if (!existing) return fail(new NotFoundError('Provider not found.'));

    let configEncrypted: string | undefined;
    if (input.config !== undefined) {
      const provider = getProvider(existing.channel, existing.provider_key);
      if (!provider) return fail(new NotFoundError('Provider implementation not found.'));
      try {
        configEncrypted = encryptJson(provider.validateConfig(input.config));
      } catch (err) {
        return fail(
          new ValidationError(
            err instanceof Error ? `Invalid provider config: ${err.message}` : 'Invalid provider config.',
            'config',
          ),
        );
      }
    }

    if (
      input.priority !== undefined &&
      input.priority !== existing.priority &&
      (await providersRepository.priorityTaken(workspaceId, existing.channel, input.priority))
    ) {
      return fail(new ConflictError(`Priority ${input.priority} is already used for this channel.`));
    }

    const updated = await providersRepository.update(workspaceId, id, {
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(configEncrypted !== undefined ? { configEncrypted } : {}),
    });
    if (!updated) return fail(new NotFoundError('Provider not found.'));
    return ok(updated);
  },

  async remove(workspaceId: string, id: string): Promise<ServiceResult<null>> {
    const removed = await providersRepository.remove(workspaceId, id);
    if (!removed) return fail(new NotFoundError('Provider not found.'));
    return ok(null);
  },
};
