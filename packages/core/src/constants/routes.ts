/**
 * Dashboard route paths. Never inline a path string in a <Link> or navigate() —
 * always reference ROUTES so a path change happens in exactly one place.
 */
export const ROUTES = {
  CONNECT: '/connect',
  OVERVIEW: '/',
  SUBSCRIBERS: '/subscribers',
  SUBSCRIBER_DETAIL: (id: string) => `/subscribers/${id}`,
  AUDIENCES: '/audiences',
  AUDIENCE_DETAIL: (id: string) => `/audiences/${id}`,
  TEMPLATES: '/templates',
  TEMPLATE_DETAIL: (id: string) => `/templates/${id}`,
  PROVIDERS: '/providers',
  ROUTING_RULES: '/routing-rules',
  NOTIFICATION_LOG: '/notification-log',
  DEAD_LETTERS: '/dead-letters',
  METRICS: '/metrics',
  TEST_DISPATCH: '/test-dispatch',
} as const;

/** Parameterized route patterns for the router (react-router path syntax). */
export const ROUTE_PATTERNS = {
  CONNECT: '/connect',
  OVERVIEW: '/',
  SUBSCRIBERS: '/subscribers',
  SUBSCRIBER_DETAIL: '/subscribers/:id',
  AUDIENCES: '/audiences',
  AUDIENCE_DETAIL: '/audiences/:id',
  TEMPLATES: '/templates',
  TEMPLATE_DETAIL: '/templates/:id',
  PROVIDERS: '/providers',
  ROUTING_RULES: '/routing-rules',
  NOTIFICATION_LOG: '/notification-log',
  DEAD_LETTERS: '/dead-letters',
  METRICS: '/metrics',
  TEST_DISPATCH: '/test-dispatch',
} as const;
