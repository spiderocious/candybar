import type {
  CreateRoutingRuleInput,
  RoutingRule,
  UpdateRoutingRuleInput,
} from '@communique/core';

import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { ok, fail, type ServiceResult } from '../../lib/service-result.js';
import { audiencesRepository } from '../audiences/audiences.repository.js';
import { templatesRepository } from '../templates/templates.repository.js';

import { routingRulesRepository } from './routing-rules.repository.js';

export const routingRulesService = {
  async create(
    workspaceId: string,
    input: CreateRoutingRuleInput,
  ): Promise<ServiceResult<RoutingRule>> {
    const template = await templatesRepository.findById(workspaceId, input.template_id);
    if (!template) return fail(new ValidationError('Template not found.', 'template_id'));
    if (template.channel !== input.channel) {
      return fail(
        new ValidationError(
          `Template channel "${template.channel}" does not match rule channel "${input.channel}".`,
          'channel',
        ),
      );
    }
    if (input.audience_id) {
      const audience = await audiencesRepository.findById(workspaceId, input.audience_id);
      if (!audience) return fail(new ValidationError('Audience not found.', 'audience_id'));
    }

    const rule = await routingRulesRepository.create({
      id: newId('rule'),
      workspaceId,
      eventType: input.event_type,
      channel: input.channel,
      audienceId: input.audience_id ?? null,
      templateId: input.template_id,
      enabled: input.enabled ?? true,
    });
    return ok(rule);
  },

  async list(workspaceId: string): Promise<ServiceResult<RoutingRule[]>> {
    return ok(await routingRulesRepository.list(workspaceId));
  },

  async get(workspaceId: string, id: string): Promise<ServiceResult<RoutingRule>> {
    const rule = await routingRulesRepository.findById(workspaceId, id);
    if (!rule) return fail(new NotFoundError('Routing rule not found.'));
    return ok(rule);
  },

  async update(
    workspaceId: string,
    id: string,
    input: UpdateRoutingRuleInput,
  ): Promise<ServiceResult<RoutingRule>> {
    const existing = await routingRulesRepository.findById(workspaceId, id);
    if (!existing) return fail(new NotFoundError('Routing rule not found.'));

    if (input.template_id) {
      const template = await templatesRepository.findById(workspaceId, input.template_id);
      if (!template) return fail(new ValidationError('Template not found.', 'template_id'));
    }
    if (input.audience_id) {
      const audience = await audiencesRepository.findById(workspaceId, input.audience_id);
      if (!audience) return fail(new ValidationError('Audience not found.', 'audience_id'));
    }

    const updated = await routingRulesRepository.update(workspaceId, id, {
      ...(input.channel !== undefined ? { channel: input.channel } : {}),
      ...(input.template_id !== undefined ? { templateId: input.template_id } : {}),
      ...(input.audience_id !== undefined ? { audienceId: input.audience_id } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    });
    if (!updated) return fail(new NotFoundError('Routing rule not found.'));
    return ok(updated);
  },

  async remove(workspaceId: string, id: string): Promise<ServiceResult<null>> {
    const removed = await routingRulesRepository.remove(workspaceId, id);
    if (!removed) return fail(new NotFoundError('Routing rule not found.'));
    return ok(null);
  },
};
