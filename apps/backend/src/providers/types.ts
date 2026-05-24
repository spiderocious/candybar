import type { Channel, ProviderKey } from '@communique/core';

/** A fully rendered message ready to hand to a provider. */
export interface RenderedMessage {
  to: string;
  subject: string | null;
  body_text: string;
  body_html: string | null;
}

/** Outcome of a single provider send. */
export type ProviderResult =
  | { ok: true; detail?: string }
  | { ok: false; kind: 'transport'; error: string } // retryable → try next provider / retry
  | { ok: false; kind: 'hard'; error: string }; // non-retryable → stop, do not fall back

/**
 * The plugin contract. Each concrete provider implements this. Core dispatch
 * never imports a provider directly — it goes through the registry.
 */
export interface ChannelProvider<Config = unknown> {
  readonly key: ProviderKey;
  readonly channel: Channel;
  /** Validate + parse stored config; throws if the shape is wrong. */
  validateConfig(raw: unknown): Config;
  send(message: RenderedMessage, config: Config): Promise<ProviderResult>;
}
