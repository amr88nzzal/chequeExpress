import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '../lib/paths';
import { PERMISSIONS } from '../permissions/catalog';
import { RequirePermission } from '../permissions/require-permission';
import { ForbiddenPage } from '../components/pages/forbidden-page';
import { NotFoundPage } from '../components/pages/not-found-page';
import { IssuedChequesPage } from '../features/issued/pages/issued-cheques-page';
import { CreateDraftPage } from '../features/drafts/pages/create-draft-page';
import { PrintChequePage } from '../features/printing/pages/print-cheque-page';

/**
 * Every data screen sits behind `RequirePermission`: the nav already hides what
 * the user cannot reach, and the route refuses it as well (a bookmark or a typed
 * URL must not bypass the guard).
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.root} element={<Navigate to={ROUTES.issued} replace />} />
      <Route
        path={ROUTES.issued}
        element={
          <RequirePermission permission={PERMISSIONS.issuedView}>
            <IssuedChequesPage />
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.createDraft}
        element={
          <RequirePermission permission={PERMISSIONS.issuedCreate}>
            <CreateDraftPage />
          </RequirePermission>
        }
      />
      <Route
        path={ROUTES.print}
        element={
          <RequirePermission permission={PERMISSIONS.issuedPrint}>
            <PrintChequePage />
          </RequirePermission>
        }
      />
      <Route path={ROUTES.forbidden} element={<ForbiddenPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
