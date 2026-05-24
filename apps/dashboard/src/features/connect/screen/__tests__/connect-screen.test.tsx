import { server } from '@app/test/server';
import { EP } from '@communique/core';
import { ENV } from '@shared/config/env';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type * as ReactRouterDom from 'react-router-dom';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouterDom>('react-router-dom');
  return { ...actual, useNavigate: () => navigateSpy };
});

const credUrl = `${ENV.API_BASE_URL}${EP.CREDENTIALS}`;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  navigateSpy.mockReset();
});
afterAll(() => server.close());

async function renderConnect() {
  // Imported lazily so the react-router-dom mock is applied first.
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const { MemoryRouter } = await import('react-router-dom');
  const { WorkspaceProvider } = await import('@shared/providers/workspace-provider');
  const { ConnectScreen } = await import('../connect-screen.js');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <WorkspaceProvider>
        <MemoryRouter>
          <ConnectScreen />
        </MemoryRouter>
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
}

describe('ConnectScreen — key verification (OBS-FE-01 regression)', () => {
  it('shows an inline error and does NOT navigate when the key is invalid', async () => {
    server.use(
      http.get(credUrl, () =>
        HttpResponse.json(
          { errorCode: 1002, errorMessage: 'Missing or invalid API credential.', type: 'auth_error' },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    await renderConnect();

    await user.type(screen.getByLabelText('Workspace API key'), 'cmq_invalid_key_value');
    await user.click(screen.getByRole('button', { name: /connect/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/invalid or has been revoked/i));
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('navigates into the app when the key is valid', async () => {
    server.use(http.get(credUrl, () => HttpResponse.json({ data: [] })));
    const user = userEvent.setup();
    await renderConnect();

    await user.type(screen.getByLabelText('Workspace API key'), 'cmq_valid_key_value');
    await user.click(screen.getByRole('button', { name: /connect/i }));

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/'));
  });
});
