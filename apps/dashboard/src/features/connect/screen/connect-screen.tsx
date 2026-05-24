import { ROUTES } from '@communique/core';
import { Show } from 'meemaw';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useWorkspace } from '@shared/providers/workspace-provider';
import { ApiError } from '@shared/services/api-error';
import { workspaceToken } from '@shared/services/workspace-token';
import { Button, Card, Field, InlineError } from '@ui/components/primitives';
import { Logo } from '@ui/components/logo';

import { useCreateWorkspace } from '../api/use-create-workspace.js';

/**
 * Entry screen. Either paste an existing workspace API key, or create a brand
 * new workspace (which returns a one-time key we connect with immediately).
 */
export function ConnectScreen() {
  const navigate = useNavigate();
  const { connect } = useWorkspace();
  const [mode, setMode] = useState<'key' | 'create'>('key');

  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [keyError, setKeyError] = useState<string>();
  const [newKey, setNewKey] = useState<string>();

  const createMutation = useCreateWorkspace();

  function handleConnectKey() {
    if (key.trim().length < 8) {
      setKeyError('Enter a valid workspace API key.');
      return;
    }
    setKeyError(undefined);
    connect(key.trim());
    navigate(ROUTES.OVERVIEW);
  }

  function handleCreate() {
    createMutation.mutate(
      { name },
      {
        onSuccess: (data) => {
          // Show the key once, then let the user proceed.
          setNewKey(data.credential.key);
          workspaceToken.set(data.credential.key);
        },
      },
    );
  }

  const createFieldError =
    createMutation.error instanceof ApiError && createMutation.error.field === 'name'
      ? createMutation.error.message
      : undefined;
  const createGeneralError =
    createMutation.error instanceof ApiError && createMutation.error.field !== 'name'
      ? createMutation.error.message
      : undefined;

  return (
    <div className="flex h-full items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <Logo className="mb-6 justify-center" />

        <div className="mb-4 flex rounded-lg bg-surface-2 p-1 text-sm font-medium">
          <button
            className={tab(mode === 'key')}
            onClick={() => setMode('key')}
            type="button"
          >
            Use API key
          </button>
          <button
            className={tab(mode === 'create')}
            onClick={() => setMode('create')}
            type="button"
          >
            New workspace
          </button>
        </div>

        <Show when={mode === 'key'}>
          <div className="flex flex-col gap-4">
            <Field
              label="Workspace API key"
              name="api-key"
              placeholder="cmq_…"
              value={key}
              error={keyError}
              onChange={(e) => setKey(e.target.value)}
              hint="Stored in memory only — you'll re-enter it after a refresh."
            />
            <Button onClick={handleConnectKey}>Connect</Button>
          </div>
        </Show>

        <Show when={mode === 'create'}>
          <Show
            when={Boolean(newKey)}
            fallback={
              <div className="flex flex-col gap-4">
                <Field
                  label="Workspace name"
                  name="name"
                  placeholder="Acme Inc."
                  value={name}
                  error={createFieldError}
                  onChange={(e) => setName(e.target.value)}
                />
                <Show when={Boolean(createGeneralError)}>
                  <InlineError message={createGeneralError ?? ''} />
                </Show>
                <Button onClick={handleCreate} loading={createMutation.isPending}>
                  Create workspace
                </Button>
              </div>
            }
          >
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text">
                Workspace created. Copy your API key — it is shown only once:
              </p>
              <code className="break-all rounded-lg bg-surface-2 p-3 text-xs">{newKey}</code>
              <Button
                onClick={() => {
                  connect(newKey!);
                  navigate(ROUTES.OVERVIEW);
                }}
              >
                I&apos;ve saved it — continue
              </Button>
            </div>
          </Show>
        </Show>
      </Card>
    </div>
  );
}

function tab(active: boolean): string {
  return `flex-1 rounded-md px-3 py-1.5 transition ${
    active ? 'bg-surface text-text shadow-sm' : 'text-text-muted'
  }`;
}
