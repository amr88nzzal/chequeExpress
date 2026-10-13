/** Standard API response envelope (docs/CONVENTIONS.md). */
export type ApiSuccess<T> = { ok: true; data: T; requestId: string };

export type ApiError = {
  ok: false;
  error: { code: string; message: string };
  requestId: string;
};

export const success = <T>(data: T, requestId: string): ApiSuccess<T> => ({
  ok: true,
  data,
  requestId,
});

/** `code` is a stable UPPER_SNAKE value; clients must never rely on `message`. */
export const failure = (code: string, message: string, requestId: string): ApiError => ({
  ok: false,
  error: { code, message },
  requestId,
});
