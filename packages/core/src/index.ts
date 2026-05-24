// Errors (flat envelope, numeric codes 1001–1009)
export {
  ERROR_CODES,
  ERROR_TYPES,
  ERROR_CODE_HTTP_STATUS,
  ERROR_CODE_TYPE,
} from './errors/error-codes.js';
export type { ErrorCode, ErrorType } from './errors/error-codes.js';
export { ErrorEnvelopeSchema } from './errors/error-envelope.js';
export type { ErrorEnvelope } from './errors/error-envelope.js';

// HTTP
export { HTTP_STATUS } from './http/http-status.js';
export type { HttpStatus } from './http/http-status.js';
export {
  PaginationMetaSchema,
  dataEnvelope,
  listEnvelope,
} from './http/success-envelope.js';
export type { SuccessEnvelope, PaginationMeta } from './http/success-envelope.js';

// Domain enums
export {
  CHANNELS,
  PROVIDER_KEYS,
  CHANNEL_PROVIDERS,
  EVENT_STATUSES,
  DISPATCH_STATUSES,
  ATTEMPT_STATUSES,
  DEAD_LETTER_REASONS,
  EVENT_TARGET_KINDS,
} from './domain/enums.js';
export type {
  Channel,
  ProviderKey,
  EventStatus,
  DispatchStatus,
  AttemptStatus,
  DeadLetterReason,
  EventTargetKind,
} from './domain/enums.js';

// Constants
export { EP } from './constants/endpoints.js';
export { ROUTES, ROUTE_PATTERNS } from './constants/routes.js';

// Schemas + inferred types
export * from './schemas/workspace.schema.js';
export * from './schemas/subscriber.schema.js';
export * from './schemas/audience.schema.js';
export * from './schemas/template.schema.js';
export * from './schemas/provider.schema.js';
export * from './schemas/routing-rule.schema.js';
export * from './schemas/event.schema.js';
export * from './schemas/dispatch.schema.js';
export * from './schemas/dead-letter.schema.js';
export * from './schemas/metrics.schema.js';
