/**
 * Success envelope (docs/CONVENTIONS.md 13): `{ data, meta }`.
 *
 * `meta` is always present (an empty object when there is nothing to add) so that
 * clients can rely on the shape instead of branch on `undefined`.
 */
import type { Response } from 'express';

export interface Meta {
  requestId: string;
  [key: string]: unknown;
}

export function sendData<TData>(
  res: Response,
  requestId: string,
  data: TData,
  meta: Record<string, unknown> = {},
  status = 200,
): void {
  res.status(status).json({ data, meta: { requestId, ...meta } });
}

/** 201 Created with the same envelope. */
export function sendCreated<TData>(
  res: Response,
  requestId: string,
  data: TData,
  meta: Record<string, unknown> = {},
): void {
  sendData(res, requestId, data, meta, 201);
}

/** 204 No Content: the one response that legitimately has no envelope. */
export function sendNoContent(res: Response): void {
  res.status(204).end();
}
