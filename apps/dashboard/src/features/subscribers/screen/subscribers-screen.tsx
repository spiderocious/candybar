import { ROUTES } from '@communique/core';
import type { Subscriber } from '@communique/core';
import { Repeat, Show } from 'meemaw';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Plus, Users } from '@icons';
import { QueryState } from '@shared/components/query-state';
import { ApiError } from '@shared/services/api-error';
import { Badge, Button, Card, EmptyState, Field, InlineError, PageHeader } from '@ui/components/primitives';

import { useRegisterSubscriber, useSubscribers } from '../api/use-subscribers.js';

export function SubscribersScreen() {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const query = useSubscribers(search || undefined);

  return (
    <div>
      <PageHeader
        title="Subscribers"
        subtitle="People and devices this workspace can reach."
        action={
          <Button onClick={() => setShowAdd((s) => !s)}>
            <Plus size={15} /> Add subscriber
          </Button>
        }
      />

      <Show when={showAdd}>
        <AddSubscriberForm onDone={() => setShowAdd(false)} />
      </Show>

      <div className="mb-4">
        <Field
          label="Search"
          name="search"
          placeholder="Search by external id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <QueryState
        query={query}
        isEmpty={(p) => p.data.length === 0}
        empty={
          <EmptyState
            icon={<Users size={40} />}
            title="No subscribers yet"
            subtitle="Register subscribers via the API or add one here."
          />
        }
      >
        {(page) => (
          <Card className="p-0">
            <Repeat each={page.data}>
              {(sub: Subscriber) => (
                <Link
                  to={ROUTES.SUBSCRIBER_DETAIL(sub.id)}
                  className="flex items-center justify-between border-b border-border px-5 py-3 last:border-0 hover:bg-surface-2"
                >
                  <div>
                    <p className="text-sm font-medium text-text">{sub.external_id}</p>
                    <p className="text-xs text-text-muted">{sub.id}</p>
                  </div>
                  <Badge tone="neutral">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </Badge>
                </Link>
              )}
            </Repeat>
          </Card>
        )}
      </QueryState>
    </div>
  );
}

function AddSubscriberForm({ onDone }: { readonly onDone: () => void }) {
  const [externalId, setExternalId] = useState('');
  const [email, setEmail] = useState('');
  const mutation = useRegisterSubscriber();

  const fieldError = (field: string) =>
    mutation.error instanceof ApiError && mutation.error.field === field
      ? mutation.error.message
      : undefined;
  const generalError =
    mutation.error instanceof ApiError && !mutation.error.field ? mutation.error.message : undefined;

  function submit() {
    mutation.mutate(
      {
        external_id: externalId,
        ...(email ? { channels: [{ channel: 'email' as const, address: email }] } : {}),
      },
      { onSuccess: onDone },
    );
  }

  return (
    <Card className="mb-4 flex flex-col gap-4">
      <Field
        label="External ID"
        name="external_id"
        placeholder="user-123"
        value={externalId}
        error={fieldError('external_id')}
        onChange={(e) => setExternalId(e.target.value)}
      />
      <Field
        label="Email (optional)"
        name="email"
        placeholder="user@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Show when={Boolean(generalError)}>
        <InlineError message={generalError ?? ''} />
      </Show>
      <div className="flex gap-2">
        <Button onClick={submit} loading={mutation.isPending}>
          Register
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
