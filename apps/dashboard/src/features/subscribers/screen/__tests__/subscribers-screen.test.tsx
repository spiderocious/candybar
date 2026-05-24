import { renderWithProviders } from '@app/test/render';
import { server } from '@app/test/server';
import { EP } from '@communique/core';
import { ENV } from '@shared/config/env';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';


import { SubscribersScreen } from '../subscribers-screen.js';

const url = `${ENV.API_BASE_URL}${EP.SUBSCRIBERS}`;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('SubscribersScreen', () => {
  it('renders the empty state when there are no subscribers', async () => {
    server.use(
      http.get(url, () => HttpResponse.json({ data: [], meta: { next_cursor: null, has_more: false } })),
    );
    renderWithProviders(<SubscribersScreen />);
    await waitFor(() => expect(screen.getByText('No subscribers yet')).toBeInTheDocument());
  });

  it('lists subscribers when data loads', async () => {
    server.use(
      http.get(url, () =>
        HttpResponse.json({
          data: [
            {
              id: 'sub_1',
              workspace_id: 'ws_1',
              external_id: 'user-1',
              attributes: {},
              is_deleted: false,
              created_at: '2026-05-24T00:00:00.000Z',
              updated_at: '2026-05-24T00:00:00.000Z',
            },
          ],
          meta: { next_cursor: null, has_more: false },
        }),
      ),
    );
    renderWithProviders(<SubscribersScreen />);
    await waitFor(() => expect(screen.getByText('user-1')).toBeInTheDocument());
  });
});
