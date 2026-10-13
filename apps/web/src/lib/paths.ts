/** Single place for route paths, so the router, the nav and the guards agree. */
export const ROUTES = {
  root: '/',
  issued: '/issued',
  createDraft: '/issued/new',
  print: '/print',
  forbidden: '/403',
} as const;

export const PRINT_CHEQUE_ID_PARAM = 'chequeId';
