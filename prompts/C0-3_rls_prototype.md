# C0 — المهمة 3: نموذج RLS وعزل المستأجرين

```
نفّذ نموذج RLS على PostgreSQL حقيقي:
- جدول تجريبي بـ `tenant_id`، RLS مفعّل و`FORCE`، سياسة `tenant_id = current_setting('app.tenant_id')::uuid`.
- مستخدم تطبيق غير مالك وبلا BYPASSRLS؛ مستخدم تهجير منفصل.
- `withTenant(ctx, fn)` يبدأ معاملة و`SET LOCAL app.tenant_id`.
- Kysely مع توليد الأنواع و`uuidv7()`.
- اختبارات تكامل (Testcontainers): مستأجر لا يقرأ ولا يعدّل ولا يحذف بيانات غيره، حتى بـ SQL مباشر وبمفتاح أجنبي؛ وبدون `app.tenant_id` لا يرى شيئاً.
- قِس الأثر على الأداء على مليون صف.
المعيار: كل الاختبارات خضراء في CI على arm64. وثّق النتائج في `docs/PLAN.md` (ملاحظات C0).
```
