import type { ApiCredential } from '@communique/core';
import { EP } from '@communique/core';
import { apiClient } from '@shared/services/api-client';
import { useMutation } from '@tanstack/react-query';


/**
 * Verifies a workspace API key by calling an authenticated endpoint. Resolves on
 * a valid key, rejects (ApiError 1002) on an invalid/revoked one — so the connect
 * screen can show an inline error instead of routing into an app that 401s.
 *
 * The caller sets the token before mutating and clears it on failure.
 */
export function useVerifyKey() {
  return useMutation({
    mutationFn: () => apiClient.get<ApiCredential[]>(EP.CREDENTIALS),
  });
}
