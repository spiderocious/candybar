import { ApiError } from '@shared/services/api-error';
import type { UseQueryResult } from '@tanstack/react-query';
import { InlineError, Spinner } from '@ui/components/primitives';
import { Show } from 'meemaw';
import type { ReactNode } from 'react';


interface QueryStateProps<T> {
  readonly query: UseQueryResult<T>;
  readonly children: (data: T) => ReactNode;
  readonly empty?: ReactNode;
  readonly isEmpty?: (data: T) => boolean;
}

/**
 * Standard loading / error / empty / loaded rendering for a React Query result.
 * Error messages come from the backend (ApiError.message), never hardcoded.
 */
export function QueryState<T>({ query, children, empty, isEmpty }: QueryStateProps<T>) {
  return (
    <>
      <Show when={query.isLoading}>
        <div className="py-8">
          <Spinner />
        </div>
      </Show>
      <Show when={query.isError}>
        <div className="py-8">
          <InlineError
            message={query.error instanceof ApiError ? query.error.message : 'Failed to load.'}
          />
        </div>
      </Show>
      <Show when={query.isSuccess}>
        {query.data !== undefined &&
          (empty && isEmpty?.(query.data) ? <>{empty}</> : <>{children(query.data as T)}</>)}
      </Show>
    </>
  );
}
