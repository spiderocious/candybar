import type { Channel, ProviderKey } from '@communique/core';

import { makeConsoleProvider } from './console/console.provider.js';
import { resendProvider } from './email/resend.provider.js';
import { twilioProvider } from './sms/twilio.provider.js';
import type { ChannelProvider } from './types.js';

/**
 * The registry is the only thing core dispatch knows about. Adding a provider =
 * implement ChannelProvider and register it here. Keyed by `${channel}:${key}`.
 */
const registry = new Map<string, ChannelProvider>();

function register(provider: ChannelProvider): void {
  registry.set(`${provider.channel}:${provider.key}`, provider);
}

register(makeConsoleProvider('email'));
register(makeConsoleProvider('sms'));
register(resendProvider as ChannelProvider);
register(twilioProvider as ChannelProvider);

export function getProvider(channel: Channel, key: ProviderKey): ChannelProvider | undefined {
  return registry.get(`${channel}:${key}`);
}

/** True if a provider key is valid for a channel (used in validation). */
export function providerExists(channel: Channel, key: ProviderKey): boolean {
  return registry.has(`${channel}:${key}`);
}
