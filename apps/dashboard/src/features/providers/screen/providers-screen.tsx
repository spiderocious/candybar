import {
  CHANNEL_PROVIDERS,
  type Channel,
  type Provider,
  type ProviderKey,
} from '@communique/core';
import { Repeat, Show } from 'meemaw';
import { useState } from 'react';

import { Plus, Settings, Trash2 } from '@icons';
import { QueryState } from '@shared/components/query-state';
import { ApiError } from '@shared/services/api-error';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  InlineError,
  PageHeader,
  TextareaField,
} from '@ui/components/primitives';

import {
  useCreateProvider,
  useDeleteProvider,
  useProviders,
  useUpdateProvider,
} from '../api/use-providers.js';

export function ProvidersScreen() {
  const [showAdd, setShowAdd] = useState(false);
  const query = useProviders();
  const update = useUpdateProvider();
  const remove = useDeleteProvider();

  return (
    <div>
      <PageHeader
        title="Providers"
        subtitle="Per-channel transports with priority-ordered fallback. Credentials are encrypted at rest."
        action={
          <Button onClick={() => setShowAdd((s) => !s)}>
            <Plus size={15} /> Add provider
          </Button>
        }
      />
      <Show when={showAdd}>
        <AddProviderForm onDone={() => setShowAdd(false)} />
      </Show>
      <QueryState
        query={query}
        isEmpty={(p) => p.length === 0}
        empty={
          <EmptyState
            icon={<Settings size={40} />}
            title="No providers configured"
            subtitle="Add a console provider to dispatch with zero setup, or a Resend/Twilio provider with credentials."
          />
        }
      >
        {(providers) => (
          <Card className="p-0">
            <Repeat each={providers}>
              {(p: Provider) => (
                <div className="flex items-center justify-between border-b border-border px-5 py-3 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-text">
                      {p.provider_key}{' '}
                      <span className="text-text-muted">· {p.channel} · priority {p.priority}</span>
                    </p>
                    <p className="text-xs text-text-muted">
                      {Object.entries(p.config_masked)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ') || 'no config'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={p.enabled ? 'success' : 'neutral'}>
                      {p.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                    <Button
                      variant="ghost"
                      onClick={() => update.mutate({ id: p.id, input: { enabled: !p.enabled } })}
                    >
                      {p.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="ghost" onClick={() => remove.mutate(p.id)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              )}
            </Repeat>
          </Card>
        )}
      </QueryState>
    </div>
  );
}

function AddProviderForm({ onDone }: { readonly onDone: () => void }) {
  const [channel, setChannel] = useState<Channel>('email');
  const [providerKey, setProviderKey] = useState<ProviderKey>('console');
  const [configJson, setConfigJson] = useState('{}');
  const [jsonError, setJsonError] = useState<string>();
  const mutation = useCreateProvider();

  const fieldError = (f: string) =>
    mutation.error instanceof ApiError && mutation.error.field === f ? mutation.error.message : undefined;
  const generalError =
    mutation.error instanceof ApiError && !mutation.error.field ? mutation.error.message : undefined;

  function submit() {
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(configJson);
    } catch {
      setJsonError('Config must be valid JSON.');
      return;
    }
    setJsonError(undefined);
    mutation.mutate({ channel, provider_key: providerKey, config }, { onSuccess: onDone });
  }

  const options = CHANNEL_PROVIDERS[channel];

  return (
    <Card className="mb-4 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="p-channel" className="text-sm font-medium">
            Channel
          </label>
          <select
            id="p-channel"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            value={channel}
            onChange={(e) => {
              const c = e.target.value as Channel;
              setChannel(c);
              setProviderKey(CHANNEL_PROVIDERS[c][0] as ProviderKey);
            }}
          >
            <option value="email">email</option>
            <option value="sms">sms</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="p-key" className="text-sm font-medium">
            Provider
          </label>
          <select
            id="p-key"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            value={providerKey}
            onChange={(e) => setProviderKey(e.target.value as ProviderKey)}
          >
            <Repeat each={options}>
              {(o) => <option value={o}>{o}</option>}
            </Repeat>
          </select>
        </div>
      </div>
      <TextareaField
        label="Config (JSON)"
        name="config"
        value={configJson}
        error={jsonError ?? fieldError('config')}
        onChange={(e) => setConfigJson(e.target.value)}
      />
      <p className="text-xs text-text-muted">
        console needs <code>{'{}'}</code>. resend needs <code>api_key</code>, <code>from_email</code>.
        twilio needs <code>account_sid</code>, <code>auth_token</code>, <code>from_number</code>.
      </p>
      <Show when={Boolean(generalError)}>
        <InlineError message={generalError ?? ''} />
      </Show>
      <div className="flex gap-2">
        <Button onClick={submit} loading={mutation.isPending}>
          Add provider
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
