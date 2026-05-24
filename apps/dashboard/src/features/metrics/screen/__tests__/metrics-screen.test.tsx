import { EP } from '@communique/core';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ENV } from '@shared/config/env';
import { renderWithProviders } from '@app/test/render';
import { server } from '@app/test/server';

import { MetricsScreen } from '../metrics-screen.js';

const url = `${ENV.API_BASE_URL}${EP.METRICS}`;

const metrics = {
  events_received: 5,
  events_processed: 4,
  events_dead: 1,
  dispatch_success: 4,
  dispatch_failure: 1,
  dispatch_success_rate: 0.8,
  retry_count: 2,
  dead_letter_count: 1,
  queue_depth: 0,
  by_channel: [{ key: 'email', count: 5 }],
  by_event_type: [{ key: 'user.welcome', count: 5 }],
  by_status: [{ key: 'success', count: 4 }],
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('MetricsScreen', () => {
  it('renders metric cards when data loads', async () => {
    server.use(http.get(url, () => HttpResponse.json({ data: metrics })));
    renderWithProviders(<MetricsScreen />);

    await waitFor(() => expect(screen.getByText('Events received')).toBeInTheDocument());
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    server.use(
      http.get(url, () =>
        HttpResponse.json(
          { errorCode: 1009, errorMessage: 'boom', type: 'internal_error' },
          { status: 500 },
        ),
      ),
    );
    renderWithProviders(<MetricsScreen />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
