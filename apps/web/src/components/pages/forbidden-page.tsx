import { StatusPage } from '../status-page';

/** 403: the route exists but the active scope does not hold its permission. */
export function ForbiddenPage() {
  return (
    <StatusPage
      titleKey="forbidden.title"
      descriptionKey="forbidden.description"
      extraKey="forbidden.requiredPermission"
      backKey="forbidden.back"
    />
  );
}
