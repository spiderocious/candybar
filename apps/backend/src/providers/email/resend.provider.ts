import { ResendConfigSchema, type Channel } from '@communique/core';
import type { z } from 'zod';

import type { ChannelProvider, ProviderResult, RenderedMessage } from '../types.js';

type ResendConfig = z.infer<typeof ResendConfigSchema>;

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Resend email provider (reference adapter). Talks to the Resend HTTP API with
 * fetch. 4xx → hard failure (won't fall back), 5xx / network → transport
 * failure (falls back to the next provider, then retries).
 */
export const resendProvider: ChannelProvider<ResendConfig> = {
  key: 'resend',
  channel: 'email' satisfies Channel,
  validateConfig: (raw) => ResendConfigSchema.parse(raw),
  async send(message: RenderedMessage, config: ResendConfig): Promise<ProviderResult> {
    const from = config.from_name
      ? `${config.from_name} <${config.from_email}>`
      : config.from_email;
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject ?? '(no subject)',
          text: message.body_text,
          ...(message.body_html ? { html: message.body_html } : {}),
        }),
      });

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, detail: data.id ?? 'sent' };
      }

      const errText = await res.text().catch(() => res.statusText);
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, kind: 'hard', error: `resend ${res.status}: ${errText}` };
      }
      return { ok: false, kind: 'transport', error: `resend ${res.status}: ${errText}` };
    } catch (err) {
      return {
        ok: false,
        kind: 'transport',
        error: err instanceof Error ? err.message : 'resend network error',
      };
    }
  },
};
