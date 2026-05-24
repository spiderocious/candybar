import type { DeadLetter } from '@communique/core';
import { Repeat, Show } from 'meemaw';
import { useState } from 'react';

import { CheckCircle2, Inbox, RefreshCw } from '@icons';
import { QueryState } from '@shared/components/query-state';
import { Badge, Button, Card, EmptyState, PageHeader } from '@ui/components/primitives';

import { useDeadLetters, useReplayDeadLetter } from '../api/use-dead-letters.js';

const REASON_TONE: Record<string, 'warning' | 'error' | 'neutral'> = {
  validation: 'warning',
  exhausted: 'error',
  no_route: 'neutral',
};

export function DeadLettersScreen() {
  const query = useDeadLetters();
  const replay = useReplayDeadLetter();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Dead letters"
        subtitle="Events that failed validation or exhausted retries. Inspect the payload and replay through the full pipeline."
      />
      <QueryState
        query={query}
        isEmpty={(p) => p.data.length === 0}
        empty={
          <EmptyState
            icon={<CheckCircle2 size={40} />}
            title="No dead letters"
            subtitle="Everything is being delivered or retried successfully."
          />
        }
      >
        {(page) => (
          <div className="flex flex-col gap-3">
            <Repeat each={page.data}>
              {(dl: DeadLetter) => (
                <Card>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{dl.event_type}</p>
                      <p className="text-xs text-text-muted">{dl.last_error}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={REASON_TONE[dl.reason] ?? 'neutral'}>{dl.reason}</Badge>
                      <Show when={Boolean(dl.replayed_at)}>
                        <Badge tone="info">replayed</Badge>
                      </Show>
                      <Button
                        variant="secondary"
                        loading={replay.isPending && replay.variables === dl.id}
                        disabled={!dl.replayable}
                        onClick={() => replay.mutate(dl.id)}
                      >
                        <RefreshCw size={14} /> Replay
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setExpanded((e) => (e === dl.id ? null : dl.id))}
                      >
                        {expanded === dl.id ? 'Hide' : 'Inspect'}
                      </Button>
                    </div>
                  </div>
                  <Show when={expanded === dl.id}>
                    <pre className="mt-3 overflow-auto rounded-lg bg-surface-2 p-3 text-xs">
                      {JSON.stringify(dl.payload_snapshot, null, 2)}
                    </pre>
                  </Show>
                </Card>
              )}
            </Repeat>
          </div>
        )}
      </QueryState>
      <Show when={Boolean(query.data?.data.length)}>
        <div className="mt-3 flex items-center gap-1 text-xs text-text-muted">
          <Inbox size={12} /> Replaying re-enqueues the event through routing, rendering and dispatch.
        </div>
      </Show>
    </div>
  );
}
