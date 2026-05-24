import { ROUTES } from '@communique/core';
import { ArrowLeft, Plus } from '@icons';
import { QueryState } from '@shared/components/query-state';
import { ApiError } from '@shared/services/api-error';
import { Button, Card, Field, InlineError, PageHeader } from '@ui/components/primitives';
import { Repeat, Show } from 'meemaw';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAddMember, useAudienceMembers } from '../api/use-audiences.js';

export function AudienceDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const membersQuery = useAudienceMembers(id);
  const addMember = useAddMember(id);
  const [subId, setSubId] = useState('');

  const addError =
    addMember.error instanceof ApiError ? addMember.error.message : undefined;

  return (
    <div>
      <Button variant="ghost" className="mb-4 px-0" onClick={() => navigate(ROUTES.AUDIENCES)}>
        <ArrowLeft size={15} /> Back to audiences
      </Button>
      <PageHeader title="Audience members" subtitle={id} />

      <Card className="mb-4 flex items-end gap-3">
        <div className="flex-1">
          <Field
            label="Add member by subscriber ID"
            name="subscriber_id"
            placeholder="sub_…"
            value={subId}
            onChange={(e) => setSubId(e.target.value)}
          />
        </div>
        <Button
          loading={addMember.isPending}
          onClick={() =>
            addMember.mutate({ subscriber_id: subId }, { onSuccess: () => setSubId('') })
          }
        >
          <Plus size={15} /> Add
        </Button>
      </Card>
      <Show when={Boolean(addError)}>
        <div className="mb-4">
          <InlineError message={addError ?? ''} />
        </div>
      </Show>

      <QueryState
        query={membersQuery}
        isEmpty={(p) => p.data.length === 0}
        empty={<p className="text-sm text-text-muted">No members yet.</p>}
      >
        {(page) => (
          <Card className="p-0">
            <Repeat each={page.data}>
              {(m) => (
                <div className="flex items-center justify-between border-b border-border px-5 py-3 last:border-0">
                  <span className="text-sm font-medium">{m.external_id}</span>
                  <span className="text-xs text-text-muted">{m.subscriber_id}</span>
                </div>
              )}
            </Repeat>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
