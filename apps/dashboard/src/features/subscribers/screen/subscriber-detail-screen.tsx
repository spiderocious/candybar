import { ROUTES, type Channel } from '@communique/core';
import { ArrowLeft, Trash2 } from '@icons';
import { QueryState } from '@shared/components/query-state';
import { Badge, Button, Card, PageHeader } from '@ui/components/primitives';
import { Repeat, Show } from 'meemaw';
import { useNavigate, useParams } from 'react-router-dom';

import {
  useDeleteSubscriber,
  useSetOptOut,
  useSubscriber,
  useSubscriberHistory,
} from '../api/use-subscribers.js';

const ATTEMPT_TONE: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
  success: 'success',
  transport_failure: 'warning',
  hard_failure: 'error',
  skipped: 'neutral',
};

export function SubscriberDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const query = useSubscriber(id);
  const historyQuery = useSubscriberHistory(id);
  const optOut = useSetOptOut(id);
  const remove = useDeleteSubscriber();

  return (
    <div>
      <Button variant="ghost" className="mb-4 px-0" onClick={() => navigate(ROUTES.SUBSCRIBERS)}>
        <ArrowLeft size={15} /> Back to subscribers
      </Button>

      <QueryState query={query}>
        {(sub) => (
          <>
            <PageHeader
              title={sub.external_id}
              subtitle={sub.id}
              action={
                <Button
                  variant="danger"
                  loading={remove.isPending}
                  onClick={() =>
                    remove.mutate(sub.id, { onSuccess: () => navigate(ROUTES.SUBSCRIBERS) })
                  }
                >
                  <Trash2 size={15} /> Delete
                </Button>
              }
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <h3 className="mb-3 text-sm font-semibold">Channels</h3>
                <Show
                  when={sub.channels.length > 0}
                  fallback={<p className="text-sm text-text-muted">No channels.</p>}
                >
                  <div className="flex flex-col gap-2">
                    <Repeat each={sub.channels}>
                      {(ch) => (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-text-muted">{ch.channel}</span>
                          <span className="font-medium">{ch.address}</span>
                        </div>
                      )}
                    </Repeat>
                  </div>
                </Show>
              </Card>

              <Card>
                <h3 className="mb-3 text-sm font-semibold">Channel opt-outs</h3>
                <div className="flex flex-col gap-2">
                  <Repeat each={['email', 'sms'] as Channel[]}>
                    {(channel) => {
                      const optedOut = sub.optouts.includes(channel);
                      return (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-text-muted">{channel}</span>
                          <Button
                            variant={optedOut ? 'secondary' : 'ghost'}
                            loading={optOut.isPending}
                            onClick={() =>
                              optOut.mutate({ channel, opted_out: !optedOut })
                            }
                          >
                            {optedOut ? 'Opted out — re-enable' : 'Opt out'}
                          </Button>
                        </div>
                      );
                    }}
                  </Repeat>
                </div>
              </Card>
            </div>

            <Card className="mt-4">
              <h3 className="mb-3 text-sm font-semibold">Notification history</h3>
              <QueryState
                query={historyQuery}
                isEmpty={(p) => p.data.length === 0}
                empty={<p className="text-sm text-text-muted">No notifications yet.</p>}
              >
                {(page) => (
                  <div className="flex flex-col gap-2">
                    <Repeat each={page.data}>
                      {(att) => (
                        <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                          <div>
                            <span className="font-medium">{att.event_type}</span>
                            <span className="ml-2 text-text-muted">
                              {att.channel} · {att.provider_key ?? '—'}
                            </span>
                          </div>
                          <Badge tone={ATTEMPT_TONE[att.status] ?? 'neutral'}>{att.status}</Badge>
                        </div>
                      )}
                    </Repeat>
                  </div>
                )}
              </QueryState>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}
