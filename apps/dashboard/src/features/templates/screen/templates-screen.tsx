import { ROUTES, type Channel, type Template } from '@communique/core';
import { Repeat, Show } from 'meemaw';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Mail, Plus } from '@icons';
import { QueryState } from '@shared/components/query-state';
import { ApiError } from '@shared/services/api-error';
import { Badge, Button, Card, EmptyState, Field, InlineError, PageHeader } from '@ui/components/primitives';

import { useCreateTemplate, useTemplates } from '../api/use-templates.js';

export function TemplatesScreen() {
  const [showAdd, setShowAdd] = useState(false);
  const query = useTemplates();
  return (
    <div>
      <PageHeader
        title="Templates"
        subtitle="Versioned message definitions tied to an event type and channel."
        action={
          <Button onClick={() => setShowAdd((s) => !s)}>
            <Plus size={15} /> New template
          </Button>
        }
      />
      <Show when={showAdd}>
        <CreateTemplateForm onDone={() => setShowAdd(false)} />
      </Show>
      <QueryState
        query={query}
        isEmpty={(p) => p.data.length === 0}
        empty={
          <EmptyState
            icon={<Mail size={40} />}
            title="No templates yet"
            subtitle="Create a template, then publish a version with your content."
          />
        }
      >
        {(page) => (
          <Card className="p-0">
            <Repeat each={page.data}>
              {(tpl: Template) => (
                <Link
                  to={ROUTES.TEMPLATE_DETAIL(tpl.id)}
                  className="flex items-center justify-between border-b border-border px-5 py-3 last:border-0 hover:bg-surface-2"
                >
                  <div>
                    <p className="text-sm font-medium text-text">{tpl.name}</p>
                    <p className="text-xs text-text-muted">{tpl.event_type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{tpl.channel}</Badge>
                    <Badge tone="info">v{tpl.latest_version}</Badge>
                  </div>
                </Link>
              )}
            </Repeat>
          </Card>
        )}
      </QueryState>
    </div>
  );
}

function CreateTemplateForm({ onDone }: { readonly onDone: () => void }) {
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState('');
  const [channel, setChannel] = useState<Channel>('email');
  const mutation = useCreateTemplate();

  const fieldError = (f: string) =>
    mutation.error instanceof ApiError && mutation.error.field === f ? mutation.error.message : undefined;
  const generalError =
    mutation.error instanceof ApiError && !mutation.error.field ? mutation.error.message : undefined;

  return (
    <Card className="mb-4 flex flex-col gap-4">
      <Field label="Name" name="name" value={name} error={fieldError('name')} onChange={(e) => setName(e.target.value)} />
      <Field
        label="Event type"
        name="event_type"
        placeholder="user.welcome"
        value={eventType}
        error={fieldError('event_type')}
        onChange={(e) => setEventType(e.target.value)}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="channel" className="text-sm font-medium">
          Channel
        </label>
        <select
          id="channel"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel)}
        >
          <option value="email">email</option>
          <option value="sms">sms</option>
        </select>
      </div>
      <Show when={Boolean(generalError)}>
        <InlineError message={generalError ?? ''} />
      </Show>
      <div className="flex gap-2">
        <Button
          loading={mutation.isPending}
          onClick={() =>
            mutation.mutate({ name, event_type: eventType, channel }, { onSuccess: onDone })
          }
        >
          Create
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
