import { ConsoleConfigSchema, type Channel } from '@communique/core';

import { logger } from '../../lib/logger.js';
import type { ChannelProvider, ProviderResult, RenderedMessage } from '../types.js';

/**
 * Zero-config provider. "Sends" by writing a structured log line. Used as the
 * default so the platform works on clone-and-run with no API keys, and as the
 * live (non-mocked) provider in E2E tests. Registered for both channels.
 */
export function makeConsoleProvider(channel: Channel): ChannelProvider {
  return {
    key: 'console',
    channel,
    validateConfig: (raw) => ConsoleConfigSchema.parse(raw ?? {}),
    async send(message: RenderedMessage): Promise<ProviderResult> {
      logger.info('console provider dispatch', {
        channel,
        to: message.to,
        subject: message.subject,
        body_preview: message.body_text.slice(0, 120),
      });
      return { ok: true, detail: 'logged by console provider' };
    },
  };
}
