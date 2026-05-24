import { HTTP_STATUS, type PaginationMeta } from '@communique/core';
import type { Response } from 'express';

/**
 * The single place responses are written. Never call res.json() directly in a
 * handler — go through ResponseUtil so the envelope stays consistent.
 */
export const ResponseUtil = {
  ok<T>(res: Response, data: T, meta?: PaginationMeta): Response {
    const body = meta !== undefined ? { data, meta } : { data };
    return res.status(HTTP_STATUS.OK).json(body);
  },

  created<T>(res: Response, data: T): Response {
    return res.status(HTTP_STATUS.CREATED).json({ data });
  },

  accepted<T>(res: Response, data: T): Response {
    return res.status(HTTP_STATUS.ACCEPTED).json({ data });
  },

  noContent(res: Response): Response {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  },
};
