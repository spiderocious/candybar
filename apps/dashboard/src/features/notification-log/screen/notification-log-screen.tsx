import type { DispatchAttempt } from '@communique/core';
import { Zap } from '@icons';
import { QueryState } from '@shared/components/query-state';
import { Badge, Card, EmptyState, PageHeader } from '@ui/components/primitives';
import { Repeat } from 'meemaw';
import { useState } from 'react';

import { useNotificationLog, type LogFilters } from '../api/use-notification-log.js';

const TONE: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
  success: 'success',
  transport_failure: 'warning',
  hard_failure: 'error',
  skipped: 'neutral',
};

export function NotificationLogScreen() {
  const [filters, setFilters] = useState<LogFilters>({});
  const query = useNotificationLog(filters);

  return (
    <div>
      <PageHeader
        title="Notification log"
        subtitle="Every dispatch attempt, with provider and outcome."
      />

      <Card className="mb-4 flex flex-wrap gap-3">
        <Select
          label="Channel"
          value={filters.channel ?? ''}
          options={['', 'email', 'sms']}
          onChange={(v) => setFilters((f) => ({ ...f, channel: v || undefined }))}
        />
        <Select
          label="Status"
          value={filters.status ?? ''}
          options={['', 'success', 'transport_failure', 'hard_failure', 'skipped']}
          onChange={(v) => setFilters((f) => ({ ...f, status: v || undefined }))}
        />
      </Card>

      <QueryState
        query={query}
        isEmpty={(p) => p.data.length === 0}
        empty={
          <EmptyState icon={<Zap size={40} />} title="No log entries" subtitle="Dispatch attempts will appear here." />
        }
      >
        {(page) => (
          <Card className="p-0">
            <Repeat each={page.data}>
              {(att: DispatchAttempt) => (
                <div className="flex items-center justify-between border-b border-border px-5 py-3 text-sm last:border-0">
                  <div>
                    <span className="font-medium">{att.event_type}</span>
                    <span className="ml-2 text-text-muted">
                      {att.channel} · {att.provider_key ?? '—'} · attempt {att.attempt_no}
                    </span>
                    {att.error_detail && (
                      <p className="text-xs text-text-muted">{att.error_detail}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={TONE[att.status] ?? 'neutral'}>{att.status}</Badge>
                    <span className="text-xs text-text-muted">
                      {new Date(att.created_at).toLocaleTimeString()}
                    </span>
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

function Select({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-text-muted">{label}</label>
      <select
        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <Repeat each={[...options]}>
          {(o) => <option value={o}>{o || 'All'}</option>}
        </Repeat>
      </select>
    </div>
  );
}
