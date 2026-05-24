import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { WorkspaceProvider } from '@shared/providers/workspace-provider';
import { workspaceToken } from '@shared/services/workspace-token';

/** Render a component inside the app providers + router for tests. */
export function renderWithProviders(ui: ReactElement, route = '/'): RenderResult {
  workspaceToken.set('cmq_test_key');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <WorkspaceProvider>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </WorkspaceProvider>
      </QueryClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}
