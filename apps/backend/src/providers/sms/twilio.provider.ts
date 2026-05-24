import { TwilioConfigSchema, type Channel } from '@communique/core';
import type { z } from 'zod';

import type { ChannelProvider, ProviderResult, RenderedMessage } from '../types.js';

type TwilioConfig = z.infer<typeof TwilioConfigSchema>;

/**
 * Twilio SMS provider (reference adapter). Posts to the Messages resource with
 * HTTP basic auth. 4xx → hard failure; 5xx / network → transport failure.
 * SMS uses body_text only (subject/html are ignored).
 */
export const twilioProvider: ChannelProvider<TwilioConfig> = {
  key: 'twilio',
  channel: 'sms' satisfies Channel,
  validateConfig: (raw) => TwilioConfigSchema.parse(raw),
  async send(message: RenderedMessage, config: TwilioConfig): Promise<ProviderResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.account_sid}/Messages.json`;
    const auth = Buffer.from(`${config.account_sid}:${config.auth_token}`).toString('base64');
    const form = new URLSearchParams({
      To: message.to,
      From: config.from_number,
      Body: message.body_text,
    });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { sid?: string };
        return { ok: true, detail: data.sid ?? 'sent' };
      }

      const errText = await res.text().catch(() => res.statusText);
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, kind: 'hard', error: `twilio ${res.status}: ${errText}` };
      }
      return { ok: false, kind: 'transport', error: `twilio ${res.status}: ${errText}` };
    } catch (err) {
      return {
        ok: false,
        kind: 'transport',
        error: err instanceof Error ? err.message : 'twilio network error',
      };
    }
  },
};
