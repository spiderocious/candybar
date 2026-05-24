import { ROUTES, type TemplateWithVersions } from '@communique/core';
import { Repeat, Show } from 'meemaw';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ArrowLeft } from '@icons';
import { QueryState } from '@shared/components/query-state';
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

import { usePreviewTemplate, usePublishVersion, useTemplate } from '../api/use-templates.js';

export function TemplateDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const query = useTemplate(id);

  return (
    <div>
      <Button variant="ghost" className="mb-4 px-0" onClick={() => navigate(ROUTES.TEMPLATES)}>
        <ArrowLeft size={15} /> Back to templates
      </Button>
      <QueryState query={query}>{(tpl) => <TemplateDetail template={tpl} />}</QueryState>
    </div>
  );
}

function TemplateDetail({ template }: { readonly template: TemplateWithVersions }) {
  return (
    <>
      <PageHeader
        title={template.name}
        subtitle={`${template.event_type} · ${template.channel}`}
        action={<Badge tone="info">v{template.latest_version}</Badge>}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PublishVersionForm templateId={template.id} isEmail={template.channel === 'email'} />
        <PreviewPanel templateId={template.id} />
      </div>

      <Card className="mt-4">
        <h3 className="mb-3 text-sm font-semibold">Versions (immutable)</h3>
        <Show
          when={template.versions.length > 0}
          fallback={<p className="text-sm text-text-muted">No versions published yet.</p>}
        >
          <div className="flex flex-col gap-2">
            <Repeat each={template.versions}>
              {(v) => (
                <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
                  <div>
                    <Badge tone="neutral">v{v.version}</Badge>
                    <span className="ml-2 text-text-muted">{v.subject ?? '(no subject)'}</span>
                  </div>
                  <span className="text-xs text-text-muted">
                    vars: {v.required_vars.join(', ') || 'none'}
                  </span>
                </div>
              )}
            </Repeat>
          </div>
        </Show>
      </Card>
    </>
  );
}

function PublishVersionForm({
  templateId,
  isEmail,
}: {
  readonly templateId: string;
  readonly isEmail: boolean;
}) {
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const mutation = usePublishVersion(templateId);

  const fieldError = (f: string) =>
    mutation.error instanceof ApiError && mutation.error.field === f ? mutation.error.message : undefined;
  const generalError =
    mutation.error instanceof ApiError && !mutation.error.field ? mutation.error.message : undefined;

  function publish() {
    mutation.mutate(
      {
        ...(isEmail && subject ? { subject } : {}),
        body_text: bodyText,
        ...(isEmail && bodyHtml ? { body_html: bodyHtml } : {}),
      },
      {
        onSuccess: () => {
          setSubject('');
          setBodyText('');
          setBodyHtml('');
        },
      },
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold">Publish new version</h3>
      <Show when={isEmail}>
        <Field
          label="Subject"
          name="subject"
          placeholder="Welcome {{name}}!"
          value={subject}
          error={fieldError('subject')}
          onChange={(e) => setSubject(e.target.value)}
        />
      </Show>
      <TextareaField
        label="Body (text)"
        name="body_text"
        placeholder="Hi {{name}}, thanks for joining."
        value={bodyText}
        error={fieldError('body_text')}
        onChange={(e) => setBodyText(e.target.value)}
      />
      <Show when={isEmail}>
        <TextareaField
          label="Body (HTML, optional)"
          name="body_html"
          placeholder="<p>Hi {{name}}</p>"
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
        />
      </Show>
      <Show when={Boolean(generalError)}>
        <InlineError message={generalError ?? ''} />
      </Show>
      <p className="text-xs text-text-muted">
        Use <code>{'{{ variable }}'}</code> placeholders. Required variables are detected
        automatically and validated before dispatch.
      </p>
      <Button onClick={publish} loading={mutation.isPending}>
        Publish version
      </Button>
    </Card>
  );
}

function PreviewPanel({ templateId }: { readonly templateId: string }) {
  const [varsJson, setVarsJson] = useState('{\n  "name": "Ada"\n}');
  const [jsonError, setJsonError] = useState<string>();
  const preview = usePreviewTemplate(templateId);

  function run() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(varsJson);
    } catch {
      setJsonError('Variables must be valid JSON.');
      return;
    }
    setJsonError(undefined);
    preview.mutate({ variables: parsed });
  }

  return (
    <Card className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold">Live preview</h3>
      <TextareaField
        label="Variables (JSON)"
        name="variables"
        value={varsJson}
        error={jsonError}
        onChange={(e) => setVarsJson(e.target.value)}
      />
      <Button variant="secondary" onClick={run} loading={preview.isPending}>
        Render preview
      </Button>
      <Show when={preview.isError}>
        <InlineError
          message={preview.error instanceof ApiError ? preview.error.message : 'Preview failed.'}
        />
      </Show>
      <Show when={Boolean(preview.data)}>
        <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
          <Show when={Boolean(preview.data?.subject)}>
            <p className="font-semibold">{preview.data?.subject}</p>
          </Show>
          <pre className="mt-1 whitespace-pre-wrap font-sans text-text">{preview.data?.body_text}</pre>
          <Show when={(preview.data?.missing_vars.length ?? 0) > 0}>
            <p className="mt-2 text-xs text-warning">
              Missing required vars: {preview.data?.missing_vars.join(', ')}
            </p>
          </Show>
        </div>
      </Show>
    </Card>
  );
}
