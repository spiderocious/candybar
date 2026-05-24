import { ulid } from 'ulid';

/** Resource id prefixes. IDs are opaque to clients — never parsed or split. */
const PREFIXES = {
  workspace: 'ws',
  credential: 'cred',
  subscriber: 'sub',
  channel: 'chn',
  audience: 'aud',
  template: 'tpl',
  templateVersion: 'tplv',
  provider: 'prov',
  rule: 'rule',
  event: 'evt',
  outbox: 'obx',
  dispatch: 'dsp',
  attempt: 'att',
  deadLetter: 'dlq',
} as const;

export type ResourceKind = keyof typeof PREFIXES;

export function newId(kind: ResourceKind): string {
  return `${PREFIXES[kind]}_${ulid().toLowerCase()}`;
}
