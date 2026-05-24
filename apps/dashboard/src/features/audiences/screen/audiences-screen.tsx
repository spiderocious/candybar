import { ROUTES, type Audience } from '@communique/core';
import { Repeat, Show } from 'meemaw';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Layers, Plus } from '@icons';
import { QueryState } from '@shared/components/query-state';
import { ApiError } from '@shared/services/api-error';
import { Badge, Button, Card, EmptyState, Field, InlineError, PageHeader } from '@ui/components/primitives';

import { useAudiences, useCreateAudience } from '../api/use-audiences.js';

export function AudiencesScreen() {
  const [showAdd, setShowAdd] = useState(false);
  const query = useAudiences();

  return (
    <div>
      <PageHeader
        title="Audiences"
        subtitle="Named groups of subscribers you dispatch to."
        action={
          <Button onClick={() => setShowAdd((s) => !s)}>
            <Plus size={15} /> New audience
          </Button>
        }
      />

      <Show when={showAdd}>
        <CreateAudienceForm onDone={() => setShowAdd(false)} />
      </Show>

      <QueryState
        query={query}
        isEmpty={(p) => p.data.length === 0}
        empty={
          <EmptyState
            icon={<Layers size={40} />}
            title="No audiences yet"
            subtitle="Create an audience to target groups of subscribers."
          />
        }
      >
        {(page) => (
          <Card className="p-0">
            <Repeat each={page.data}>
              {(aud: Audience) => (
                <Link
                  to={ROUTES.AUDIENCE_DETAIL(aud.id)}
                  className="flex items-center justify-between border-b border-border px-5 py-3 last:border-0 hover:bg-surface-2"
                >
                  <div>
                    <p className="text-sm font-medium text-text">{aud.name}</p>
                    <Show when={Boolean(aud.description)}>
                      <p className="text-xs text-text-muted">{aud.description}</p>
                    </Show>
                  </div>
                  <Badge tone="info">{aud.member_count} members</Badge>
                </Link>
              )}
            </Repeat>
          </Card>
        )}
      </QueryState>
    </div>
  );
}

function CreateAudienceForm({ onDone }: { readonly onDone: () => void }) {
  const [name, setName] = useState('');
  const mutation = useCreateAudience();
  const fieldError =
    mutation.error instanceof ApiError && mutation.error.field === 'name'
      ? mutation.error.message
      : undefined;
  const generalError =
    mutation.error instanceof ApiError && !mutation.error.field ? mutation.error.message : undefined;

  return (
    <Card className="mb-4 flex flex-col gap-4">
      <Field
        label="Name"
        name="name"
        placeholder="All users"
        value={name}
        error={fieldError}
        onChange={(e) => setName(e.target.value)}
      />
      <Show when={Boolean(generalError)}>
        <InlineError message={generalError ?? ''} />
      </Show>
      <div className="flex gap-2">
        <Button onClick={() => mutation.mutate({ name }, { onSuccess: onDone })} loading={mutation.isPending}>
          Create
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
