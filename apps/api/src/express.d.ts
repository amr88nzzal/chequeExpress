// Adds the per-request id set by the request-id middleware in app.ts.
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}
export {};
