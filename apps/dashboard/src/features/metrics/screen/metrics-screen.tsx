import type { Metrics } from '@communique/core';
import { Repeat } from 'meemaw';

import { QueryState } from '@shared/components/query-state';
import { Card, PageHeader } from '@ui/components/primitives';

import { useMetrics } from '../api/use-metrics.js';

export function MetricsScreen() {
  const query = useMetrics();
  return (
    <div>
      <PageHeader title="Overview" subtitle="Live dispatch metrics for this workspace." />
      <QueryState query={query}>{(m) => <MetricsContent metrics={m} />}</QueryState>
    </div>
  );
}

function MetricsContent({ metrics }: { readonly metrics: Metrics }) {
  const cards = [
    { label: 'Events received', value: metrics.events_received },
    { label: 'Events processed', value: metrics.events_processed },
    { label: 'Dispatch success', value: metrics.dispatch_success },
    { label: 'Dispatch failure', value: metrics.dispatch_failure },
    { label: 'Success rate', value: `${Math.round(metrics.dispatch_success_rate * 100)}%` },
    { label: 'Retries', value: metrics.retry_count },
    { label: 'Dead letters', value: metrics.dead_letter_count },
    { label: 'Queue depth', value: metrics.queue_depth },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Repeat each={cards}>
          {(c) => (
            <Card>
              <p className="text-sm text-text-muted">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold text-text">{c.value}</p>
            </Card>
          )}
        </Repeat>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Breakdown title="By channel" rows={metrics.by_channel} />
        <Breakdown title="By status" rows={metrics.by_status} />
      </div>
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  readonly title: string;
  readonly rows: readonly { key: string; count: number }[];
}) {
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-text">{title}</h3>
      <div className="flex flex-col gap-2">
        <Repeat each={rows}>
          {(r) => (
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">{r.key}</span>
              <span className="font-medium text-text">{r.count}</span>
            </div>
          )}
        </Repeat>
      </div>
    </Card>
  );
}
