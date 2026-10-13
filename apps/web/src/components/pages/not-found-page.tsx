import { StatusPage } from '../status-page';

/** 404: the screen does not exist, or the record is outside the tenant scope. */
export function NotFoundPage() {
  return (
    <StatusPage
      titleKey="notFound.title"
      descriptionKey="notFound.description"
      backKey="notFound.back"
    />
  );
}
