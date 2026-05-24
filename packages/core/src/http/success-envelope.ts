import { z } from 'zod';

/**
 * Success envelope. Data responses are wrapped in `{ data, meta? }`.
 * `meta` carries cursor-pagination info on list responses.
 */
export interface SuccessEnvelope<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  next_cursor: string | null;
  has_more: boolean;
}

export const PaginationMetaSchema = z.object({
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
});

/** Build a Zod schema for `{ data: <item> }`. */
export const dataEnvelope = <T extends z.ZodTypeAny>(item: T) => z.object({ data: item });

/** Build a Zod schema for `{ data: <item>[], meta }`. */
export const listEnvelope = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: z.array(item), meta: PaginationMetaSchema });
