/**
 * Single source of truth for backend API paths. Both the dashboard and any
 * integration code should reference these rather than hand-writing URLs.
 * All paths are relative to the API base (e.g. http://localhost:4000).
 */
export const EP = {
  HEALTH: '/health',
  READY: '/health/ready',

  // Workspaces & credentials (bootstrap / admin)
  WORKSPACES: '/api/v1/workspaces',
  WORKSPACE: (id: string) => `/api/v1/workspaces/${id}`,
  CREDENTIALS: '/api/v1/workspace/credentials',
  CREDENTIAL: (id: string) => `/api/v1/workspace/credentials/${id}`,
  CREDENTIAL_ROTATE: (id: string) => `/api/v1/workspace/credentials/${id}/rotate`,

  // Subscribers
  SUBSCRIBERS: '/api/v1/subscribers',
  SUBSCRIBER: (id: string) => `/api/v1/subscribers/${id}`,
  SUBSCRIBER_CHANNELS: (id: string) => `/api/v1/subscribers/${id}/channels`,
  SUBSCRIBER_CHANNEL: (id: string, channelId: string) =>
    `/api/v1/subscribers/${id}/channels/${channelId}`,
  SUBSCRIBER_OPTOUTS: (id: string) => `/api/v1/subscribers/${id}/optouts`,
  SUBSCRIBER_HISTORY: (id: string) => `/api/v1/subscribers/${id}/history`,

  // Audiences
  AUDIENCES: '/api/v1/audiences',
  AUDIENCE: (id: string) => `/api/v1/audiences/${id}`,
  AUDIENCE_MEMBERS: (id: string) => `/api/v1/audiences/${id}/members`,
  AUDIENCE_MEMBER: (id: string, subscriberId: string) =>
    `/api/v1/audiences/${id}/members/${subscriberId}`,

  // Templates
  TEMPLATES: '/api/v1/templates',
  TEMPLATE: (id: string) => `/api/v1/templates/${id}`,
  TEMPLATE_VERSIONS: (id: string) => `/api/v1/templates/${id}/versions`,
  TEMPLATE_VERSION: (id: string, version: number) =>
    `/api/v1/templates/${id}/versions/${version}`,
  TEMPLATE_PREVIEW: (id: string) => `/api/v1/templates/${id}/preview`,

  // Providers
  PROVIDERS: '/api/v1/providers',
  PROVIDER: (id: string) => `/api/v1/providers/${id}`,

  // Routing rules
  ROUTING_RULES: '/api/v1/routing-rules',
  ROUTING_RULE: (id: string) => `/api/v1/routing-rules/${id}`,

  // Event ingestion
  EVENTS: '/api/v1/events',
  EVENT: (id: string) => `/api/v1/events/${id}`,

  // Observability
  NOTIFICATION_LOG: '/api/v1/notification-log',
  DEAD_LETTERS: '/api/v1/dead-letters',
  DEAD_LETTER: (id: string) => `/api/v1/dead-letters/${id}`,
  DEAD_LETTER_REPLAY: (id: string) => `/api/v1/dead-letters/${id}/replay`,
  METRICS: '/api/v1/metrics',

  // Manual test dispatch
  TEST_DISPATCH: '/api/v1/test-dispatch',
} as const;
