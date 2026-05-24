import type { DispatchStatus, TestDispatchInput, TestDispatchResult } from '@communique/core';

import { dispatchRepository } from '../../dispatch/dispatch.repository.js';
import { NotFoundError, UnprocessableError } from '../../lib/errors.js';
import { ok, fail, type ServiceResult } from '../../lib/service-result.js';
import { missingRequiredVars, renderTemplate } from '../../lib/template-render.js';
import { getProvider } from '../../providers/registry.js';
import type { RenderedMessage } from '../../providers/types.js';
import { eventsRepository } from '../events/events.repository.js';
import { providersRepository } from '../providers/providers.repository.js';
import { subscribersRepository } from '../subscribers/subscribers.repository.js';
import { templatesRepository } from '../templates/templates.repository.js';

/**
 * Manually dispatch one template to one subscriber, synchronously, and return the
 * outcome. Goes through the same render → opt-out → provider-fallback path as the
 * worker, but does not enqueue — the caller sees the result immediately.
 */
export const testDispatchService = {
  async run(
    workspaceId: string,
    input: TestDispatchInput,
  ): Promise<ServiceResult<TestDispatchResult>> {
    const template = await templatesRepository.findById(workspaceId, input.template_id);
    if (!template) return fail(new NotFoundError('Template not found.'));

    const version = input.version
      ? await templatesRepository.getVersion(input.template_id, input.version)
      : await templatesRepository.getLatestVersion(input.template_id);
    if (!version) return fail(new UnprocessableError('Template has no published version.'));

    const subscriber = await subscribersRepository.findByExternalId(
      workspaceId,
      input.subscriber_external_id,
    );
    if (!subscriber) return fail(new NotFoundError('Subscriber not found.'));

    const channels = await subscribersRepository.listChannels(subscriber.id);
    const channel = channels.find((c) => c.channel === template.channel);
    if (!channel) {
      return fail(
        new UnprocessableError(
          `Subscriber has no "${template.channel}" address to receive this template.`,
        ),
      );
    }

    const syntheticEventId = await eventsRepository.insertSynthetic({
      workspaceId,
      eventType: 'test.dispatch',
      targetRef: subscriber.external_id,
    });
    const dispatchId = await dispatchRepository.upsertDispatch({
      workspaceId,
      eventId: syntheticEventId,
      subscriberId: subscriber.id,
      channel: template.channel,
      templateVersionId: version.id,
    });

    const vars = input.variables ?? {};
    const missing = missingRequiredVars(version.required_vars, vars);
    if (missing.length > 0) {
      return fail(
        new UnprocessableError(`Missing required variables: ${missing.join(', ')}`),
      );
    }

    if (await dispatchRepository.isOptedOut(subscriber.id, template.channel)) {
      return ok({
        dispatch_id: dispatchId,
        status: 'skipped_optout' as DispatchStatus,
        provider_key: null,
        detail: 'Subscriber opted out of this channel.',
      });
    }

    const message: RenderedMessage = {
      to: channel.address,
      subject: version.subject ? renderTemplate(version.subject, vars).output : null,
      body_text: renderTemplate(version.body_text, vars).output,
      body_html: version.body_html ? renderTemplate(version.body_html, vars).output : null,
    };

    const providers = await providersRepository.resolveForChannel(workspaceId, template.channel);
    if (providers.length === 0) {
      return fail(
        new UnprocessableError(`No enabled provider configured for channel ${template.channel}.`),
      );
    }

    let lastError: string | null = null;
    let attemptNo = 0;
    for (const resolved of providers) {
      attemptNo += 1;
      const provider = getProvider(resolved.channel, resolved.provider_key);
      if (!provider) continue;
      let result;
      try {
        result = await provider.send(message, provider.validateConfig(resolved.config));
      } catch (err) {
        result = { ok: false as const, kind: 'transport' as const, error: err instanceof Error ? err.message : 'threw' };
      }

      await dispatchRepository.recordAttempt({
        dispatchId,
        workspaceId,
        subscriberId: subscriber.id,
        eventType: template.event_type,
        channel: template.channel,
        providerKey: resolved.provider_key,
        attemptNo,
        status: result.ok ? 'success' : result.kind === 'hard' ? 'hard_failure' : 'transport_failure',
        errorCode: result.ok ? null : result.kind === 'hard' ? 'provider_hard' : 'provider_transient',
        errorDetail: result.ok ? (result.detail ?? null) : result.error,
      });

      if (result.ok) {
        await dispatchRepository.setDispatchStatus(dispatchId, 'sent', true);
        return ok({
          dispatch_id: dispatchId,
          status: 'sent' as DispatchStatus,
          provider_key: resolved.provider_key,
          detail: result.detail ?? null,
        });
      }
      if (result.kind === 'hard') {
        await dispatchRepository.setDispatchStatus(dispatchId, 'failed', true);
        return ok({
          dispatch_id: dispatchId,
          status: 'failed' as DispatchStatus,
          provider_key: resolved.provider_key,
          detail: result.error,
        });
      }
      lastError = result.error;
    }

    await dispatchRepository.setDispatchStatus(dispatchId, 'failed', true);
    return ok({
      dispatch_id: dispatchId,
      status: 'failed' as DispatchStatus,
      provider_key: null,
      detail: lastError ?? 'All providers failed.',
    });
  },
};
