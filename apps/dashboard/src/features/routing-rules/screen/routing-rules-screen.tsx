import type { Channel, RoutingRule } from '@communique/core';
import { Repeat, Show } from 'meemaw';
import { useState } from 'react';

import { Plus, Route as RouteIcon, Trash2 } from '@icons';
import { QueryState } from '@shared/components/query-state';
import { ApiError } from '@shared/services/api-error';
import { Badge, Button, Card, EmptyState, Field, InlineError, PageHeader } from '@ui/components/primitives';
import { useAudiences } from '@features/audiences/api/use-audiences';
import { useTemplates } from '@features/templates/api/use-templates';

import {
  useCreateRoutingRule,
  useDeleteRoutingRule,
  useRoutingRules,
} from '../api/use-routing-rules.js';

export function RoutingRulesScreen() {
  const [showAdd, setShowAdd] = useState(false);
  const query = useRoutingRules();
  const remove = useDeleteRoutingRule();

  return (
    <div>
      <PageHeader
        title="Routing rules"
        subtitle="When an event arrives, dispatch via a channel using a template — to an audience or directly."
        action={
          <Button onClick={() => setShowAdd((s) => !s)}>
            <Plus size={15} /> New rule
          </Button>
        }
      />
      <Show when={showAdd}>
        <CreateRuleForm onDone={() => setShowAdd(false)} />
      </Show>
      <QueryState
        query={query}
        isEmpty={(r) => r.length === 0}
        empty={
          <EmptyState
            icon={<RouteIcon size={40} />}
            title="No routing rules"
            subtitle="Create a rule so published events know where to go."
          />
        }
      >
        {(rules) => (
          <Card className="p-0">
            <Repeat each={rules}>
              {(rule: RoutingRule) => (
                <div className="flex items-center justify-between border-b border-border px-5 py-3 last:border-0">
                  <div className="text-sm">
                    <span className="font-medium">{rule.event_type}</span>
                    <span className="text-text-muted"> → {rule.channel}</span>
                    <span className="text-text-muted">
                      {' '}
                      → {rule.audience_id ? 'audience' : 'direct'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={rule.enabled ? 'success' : 'neutral'}>
                      {rule.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                    <Button variant="ghost" onClick={() => remove.mutate(rule.id)}>
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

function CreateRuleForm({ onDone }: { readonly onDone: () => void }) {
  const templates = useTemplates();
  const audiences = useAudiences();
  const mutation = useCreateRoutingRule();

  const [eventType, setEventType] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const [templateId, setTemplateId] = useState('');
  const [audienceId, setAudienceId] = useState('');

  const fieldError = (f: string) =>
    mutation.error instanceof ApiError && mutation.error.field === f ? mutation.error.message : undefined;
  const generalError =
    mutation.error instanceof ApiError && !mutation.error.field ? mutation.error.message : undefined;

  function submit() {
    mutation.mutate(
      {
        event_type: eventType,
        channel,
        template_id: templateId,
        ...(audienceId ? { audience_id: audienceId } : {}),
      },
      { onSuccess: onDone },
    );
  }

  return (
    <Card className="mb-4 flex flex-col gap-4">
      <Field
        label="Event type"
        name="event_type"
        placeholder="user.welcome"
        value={eventType}
        error={fieldError('event_type')}
        onChange={(e) => setEventType(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="r-channel" className="text-sm font-medium">
            Channel
          </label>
          <select
            id="r-channel"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
          >
            <option value="email">email</option>
            <option value="sms">sms</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="r-template" className="text-sm font-medium">
            Template
          </label>
          <select
            id="r-template"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">Select…</option>
            <Repeat each={templates.data?.data ?? []}>
              {(t) => (
                <option value={t.id}>
                  {t.name} ({t.channel})
                </option>
              )}
            </Repeat>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="r-audience" className="text-sm font-medium">
          Audience (optional — leave blank for direct-target events)
        </label>
        <select
          id="r-audience"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          value={audienceId}
          onChange={(e) => setAudienceId(e.target.value)}
        >
          <option value="">Direct target</option>
          <Repeat each={audiences.data?.data ?? []}>
            {(a) => <option value={a.id}>{a.name}</option>}
          </Repeat>
        </select>
      </div>
      <Show when={Boolean(fieldError('template_id'))}>
        <InlineError message={fieldError('template_id') ?? ''} />
      </Show>
      <Show when={Boolean(generalError)}>
        <InlineError message={generalError ?? ''} />
      </Show>
      <div className="flex gap-2">
        <Button onClick={submit} loading={mutation.isPending}>
          Create rule
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
