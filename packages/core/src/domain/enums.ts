export const CHANNELS = ['email', 'sms'] as const;
export type Channel = (typeof CHANNELS)[number];

export const PROVIDER_KEYS = ['console', 'resend', 'twilio'] as const;
export type ProviderKey = (typeof PROVIDER_KEYS)[number];

/** Which provider keys are valid for which channel. */
export const CHANNEL_PROVIDERS: Record<Channel, readonly ProviderKey[]> = {
  email: ['console', 'resend'],
  sms: ['console', 'twilio'],
};

/** Lifecycle of an ingested event. */
export const EVENT_STATUSES = ['received', 'processing', 'dispatched', 'failed', 'dead'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Lifecycle of a single (subscriber × channel) dispatch. */
export const DISPATCH_STATUSES = [
  'pending',
  'sent',
  'failed',
  'skipped_optout',
  'dead',
] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

/** Outcome of one provider send attempt (the notification-log row). */
export const ATTEMPT_STATUSES = ['success', 'transport_failure', 'hard_failure', 'skipped'] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

/** Why an event landed in the dead-letter queue. */
export const DEAD_LETTER_REASONS = ['validation', 'exhausted', 'no_route'] as const;
export type DeadLetterReason = (typeof DEAD_LETTER_REASONS)[number];

/** How an event targets recipients. */
export const EVENT_TARGET_KINDS = ['audience', 'subscriber'] as const;
export type EventTargetKind = (typeof EVENT_TARGET_KINDS)[number];
