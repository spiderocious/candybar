import { Repeat, Show } from 'meemaw';
import { useState } from 'react';

import { Send } from '@icons';
import { ApiError } from '@shared/services/api-error';
import {
  Badge,
  Button,
  Card,
  Field,
  InlineError,
  PageHeader,
  TextareaField,
} from '@ui/components/primitives';
import { useTemplates } from '@features/templates/api/use-templates';

import { useTestDispatch } from '../api/use-test-dispatch.js';

const STATUS_TONE: Record<string, 'success' | 'error' | 'neutral'> = {
  sent: 'success',
  failed: 'error',
  skipped_optout: 'neutral',
};

export function TestDispatchScreen() {
  const templates = useTemplates();
  const dispatch = useTestDispatch();

  const [externalId, setExternalId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [varsJson, setVarsJson] = useState('{\n  "name": "Ada"\n}');
  const [jsonError, setJsonError] = useState<string>();

  const fieldError = (f: string) =>
    dispatch.error instanceof ApiError && dispatch.error.field === f ? dispatch.error.message : undefined;
  const generalError =
    dispatch.error instanceof ApiError && !dispatch.error.field ? dispatch.error.message : undefined;

  function run() {
    let variables: Record<string, unknown> = {};
    if (varsJson.trim()) {
      try {
        variables = JSON.parse(varsJson);
      } catch {
        setJsonError('Variables must be valid JSON.');
        return;
      }
    }
    setJsonError(undefined);
    dispatch.mutate({ subscriber_external_id: externalId, template_id: templateId, variables });
  }

  return (
    <div>
      <PageHeader
        title="Test dispatch"
        subtitle="Send any template to a specific subscriber right now, and see the result immediately."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <Field
            label="Subscriber external ID"
            name="subscriber_external_id"
            placeholder="user-123"
            value={externalId}
            error={fieldError('subscriber_external_id')}
            onChange={(e) => setExternalId(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="td-template" className="text-sm font-medium">
              Template
            </label>
            <select
              id="td-template"
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
          <TextareaField
            label="Variables (JSON)"
            name="variables"
            value={varsJson}
            error={jsonError}
            onChange={(e) => setVarsJson(e.target.value)}
          />
          <Show when={Boolean(generalError)}>
            <InlineError message={generalError ?? ''} />
          </Show>
          <Button onClick={run} loading={dispatch.isPending} disabled={!externalId || !templateId}>
            <Send size={15} /> Send test
          </Button>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold">Result</h3>
          <Show
            when={Boolean(dispatch.data)}
            fallback={<p className="text-sm text-text-muted">Run a test to see the outcome.</p>}
          >
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Status</span>
                <Badge tone={STATUS_TONE[dispatch.data?.status ?? ''] ?? 'neutral'}>
                  {dispatch.data?.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Provider</span>
                <span className="font-medium">{dispatch.data?.provider_key ?? '—'}</span>
              </div>
              <Show when={Boolean(dispatch.data?.detail)}>
                <p className="text-xs text-text-muted">{dispatch.data?.detail}</p>
              </Show>
            </div>
          </Show>
        </Card>
      </div>
    </div>
  );
}
