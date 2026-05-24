import type { Channel, RoutingRule } from '@communique/core';

import { eventsRepository } from '../features/events/events.repository.js';
import { providersRepository, type ResolvedProvider } from '../features/providers/providers.repository.js';
import { routingRulesRepository } from '../features/routing-rules/routing-rules.repository.js';
import { templatesRepository } from '../features/templates/templates.repository.js';
import { logger } from '../lib/logger.js';
import { missingRequiredVars, renderTemplate } from '../lib/template-render.js';
import { getProvider } from '../providers/registry.js';
import type { RenderedMessage } from '../providers/types.js';

import { dispatchRepository } from './dispatch.repository.js';

/** Raised when the whole event should be retried by the queue (transient). */
export class RetryableDispatchError extends Error {}

interface Target {
  subscriber_id: string;
  external_id: string;
  address: string;
}

/**
 * Process a single event end-to-end. This is invoked by the BullMQ worker.
 *
 * Outcomes:
 *  - validation failure (missing required vars) → dead-letter (reason=validation), no throw
 *  - no matching routing rule / no targets    → dead-letter (reason=no_route), no throw
 *  - some sends succeed, some hard-fail        → recorded; event marked dispatched
 *  - every provider transient-fails           → throw RetryableDispatchError (queue retries)
 *
 * The worker's `attempts` exhaustion turns the final throw into a
 * dead-letter(reason=exhausted) via the worker's failed handler.
 */
export async function processEvent(workspaceId: string, eventId: string): Promise<void> {
  const event = await eventsRepository.findById(workspaceId, eventId);
  if (!event) {
    logger.warn('dispatch: event not found', { eventId });
    return;
  }

  await eventsRepository.setStatus(eventId, 'processing');

  const rules = await routingRulesRepository.findEnabledForEvent(workspaceId, event.event_type);
  if (rules.length === 0) {
    await deadLetterEvent(workspaceId, event.id, event.event_type, 'no_route', 'No enabled routing rule for event type.', event.payload);
    return;
  }

  let anyTransientFailureUnresolved = false;
  let producedAnyDispatch = false;

  for (const rule of rules) {
    const targets = await resolveTargets(workspaceId, event, rule);
    for (const target of targets) {
      producedAnyDispatch = true;
      const result = await dispatchToTarget(workspaceId, event, rule, target);
      if (result === 'transient_unresolved') anyTransientFailureUnresolved = true;
    }
  }

  // If nothing matched a recipient at all, that's a routing dead-letter.
  if (!producedAnyDispatch) {
    await deadLetterEvent(
      workspaceId,
      event.id,
      event.event_type,
      'no_route',
      'No subscribers matched the event target for the routed channel.',
      event.payload,
    );
    return;
  }

  if (anyTransientFailureUnresolved) {
    await eventsRepository.setStatus(eventId, 'processing');
    throw new RetryableDispatchError('One or more dispatches failed transiently; will retry.');
  }

  await eventsRepository.setStatus(eventId, 'dispatched');
}

async function resolveTargets(
  workspaceId: string,
  event: { target_kind: string; target_ref: string },
  rule: RoutingRule,
): Promise<Target[]> {
  if (event.target_kind === 'subscriber') {
    const t = await dispatchRepository.directTarget(workspaceId, event.target_ref, rule.channel);
    return t ? [t] : [];
  }
  // audience event — the rule may itself constrain to an audience
  const audienceId = rule.audience_id ?? event.target_ref;
  return dispatchRepository.audienceTargets(workspaceId, audienceId, rule.channel);
}

type TargetOutcome = 'sent' | 'skipped' | 'hard_failed' | 'transient_unresolved';

async function dispatchToTarget(
  workspaceId: string,
  event: { id: string; event_type: string; payload: Record<string, unknown> },
  rule: RoutingRule,
  target: Target,
): Promise<TargetOutcome> {
  const channel = rule.channel;

  // 1) Resolve the template version to use (latest published).
  const version = await templatesRepository.getLatestVersion(rule.template_id);
  const dispatchId = await dispatchRepository.upsertDispatch({
    workspaceId,
    eventId: event.id,
    subscriberId: target.subscriber_id,
    channel,
    templateVersionId: version?.id ?? null,
  });

  if (!version) {
    await recordAttempt(workspaceId, dispatchId, target, event, channel, null, 0, 'hard_failure', 'no_version', 'Template has no published version.');
    await dispatchRepository.setDispatchStatus(dispatchId, 'failed', true);
    return 'hard_failed';
  }

  // 2) Respect opt-out.
  if (await dispatchRepository.isOptedOut(target.subscriber_id, channel)) {
    await recordAttempt(workspaceId, dispatchId, target, event, channel, null, 0, 'skipped', 'opted_out', 'Subscriber opted out of channel.');
    await dispatchRepository.setDispatchStatus(dispatchId, 'skipped_optout', false);
    return 'skipped';
  }

  // 3) Validate required vars; missing → dead-letter, never silent drop.
  const missing = missingRequiredVars(version.required_vars, event.payload);
  if (missing.length > 0) {
    await recordAttempt(workspaceId, dispatchId, target, event, channel, null, 0, 'hard_failure', 'missing_vars', `Missing required variables: ${missing.join(', ')}`);
    await dispatchRepository.setDispatchStatus(dispatchId, 'failed', true);
    await deadLetterEvent(workspaceId, event.id, event.event_type, 'validation', `Missing required variables: ${missing.join(', ')}`, event.payload);
    return 'hard_failed';
  }

  // 4) Render.
  const message: RenderedMessage = {
    to: target.address,
    subject: version.subject ? renderTemplate(version.subject, event.payload).output : null,
    body_text: renderTemplate(version.body_text, event.payload).output,
    body_html: version.body_html ? renderTemplate(version.body_html, event.payload).output : null,
  };

  // 5) Provider fallback by priority.
  const providers = await providersRepository.resolveForChannel(workspaceId, channel);
  if (providers.length === 0) {
    await recordAttempt(workspaceId, dispatchId, target, event, channel, null, 0, 'hard_failure', 'no_provider', `No enabled provider configured for channel ${channel}.`);
    await dispatchRepository.setDispatchStatus(dispatchId, 'failed', true);
    await deadLetterEvent(workspaceId, event.id, event.event_type, 'no_route', `No enabled provider for channel ${channel}.`, event.payload);
    return 'hard_failed';
  }

  let attemptNo = 0;
  let lastTransientError: string | null = null;

  for (const resolved of providers) {
    attemptNo += 1;
    const outcome = await attemptSend(resolved, message);

    if (outcome.ok) {
      await recordAttempt(workspaceId, dispatchId, target, event, channel, resolved.provider_key, attemptNo, 'success', null, outcome.detail ?? null);
      await dispatchRepository.setDispatchStatus(dispatchId, 'sent', true);
      return 'sent';
    }

    if (outcome.kind === 'hard') {
      // Hard failure does NOT fall back — the message is undeliverable as-is.
      await recordAttempt(workspaceId, dispatchId, target, event, channel, resolved.provider_key, attemptNo, 'hard_failure', 'provider_hard', outcome.error);
      await dispatchRepository.setDispatchStatus(dispatchId, 'failed', true);
      return 'hard_failed';
    }

    // Transient failure → record and try the next provider.
    lastTransientError = outcome.error;
    await recordAttempt(workspaceId, dispatchId, target, event, channel, resolved.provider_key, attemptNo, 'transport_failure', 'provider_transient', outcome.error);
  }

  // Every provider transient-failed → leave dispatch failed; signal queue retry.
  await dispatchRepository.setDispatchStatus(dispatchId, 'failed', true);
  logger.warn('dispatch: all providers transient-failed', {
    eventId: event.id,
    channel,
    lastTransientError,
  });
  return 'transient_unresolved';
}

async function attemptSend(resolved: ResolvedProvider, message: RenderedMessage) {
  const provider = getProvider(resolved.channel, resolved.provider_key);
  if (!provider) {
    return { ok: false as const, kind: 'hard' as const, error: 'Provider implementation missing.' };
  }
  try {
    const config = provider.validateConfig(resolved.config);
    return await provider.send(message, config);
  } catch (err) {
    return {
      ok: false as const,
      kind: 'transport' as const,
      error: err instanceof Error ? err.message : 'provider threw',
    };
  }
}

function recordAttempt(
  workspaceId: string,
  dispatchId: string,
  target: Target,
  event: { event_type: string },
  channel: Channel,
  providerKey: string | null,
  attemptNo: number,
  status: 'success' | 'transport_failure' | 'hard_failure' | 'skipped',
  errorCode: string | null,
  errorDetail: string | null,
) {
  return dispatchRepository.recordAttempt({
    dispatchId,
    workspaceId,
    subscriberId: target.subscriber_id,
    eventType: event.event_type,
    channel,
    providerKey,
    attemptNo,
    status,
    errorCode,
    errorDetail,
  });
}

async function deadLetterEvent(
  workspaceId: string,
  eventId: string,
  eventType: string,
  reason: 'validation' | 'no_route' | 'exhausted',
  lastError: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await dispatchRepository.deadLetter({ workspaceId, eventId, eventType, reason, lastError, payload });
  await eventsRepository.setStatus(eventId, reason === 'exhausted' ? 'failed' : 'dead');
}

export const __dispatchInternals = { deadLetterEvent };
