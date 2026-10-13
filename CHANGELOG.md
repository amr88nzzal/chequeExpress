# سجل التغييرات

جميع التغييرات الجوهرية تُوثَّق هنا. التنسيق: [Keep a Changelog](https://keepachangelog.com/)، والإصدارات وفق [Semantic Versioning](https://semver.org/).

## [غير مُصدَر]

### أُضيف — تأسيس المرحلة C0 (2026-10-12)

- بنية npm workspaces: `apps/api`, `apps/web`, `packages/words`, `packages/cheque-render`.
- إعداد TypeScript صارم (`strict`) مع تشغيل ملفات `.ts` مباشرة بلا خطوة بناء على Node 22.
- ESLint (flat config) + Prettier + `eslint-config-prettier`.
- Vitest مع `pool: 'threads'` و`resolve.preserveSymlinks` وإعداد `vitest.config.mjs` بجافاسكربت عادي (انظر `AGENTS.md`).
- GitHub Actions: أنواع، lint، تنسيق، اختبارات، اختبارات تكامل على PostgreSQL 17، وبناء الواجهة.
- `packages/cheque-render`: توليد PDF بمقاس الشيك بالمليمتر بمكتبة PDF صافية مع تشكيل عربي — بدل نموذج Playwright.
- `apps/api`: `/health`، غلاف الاستجابة والأخطاء، طبقات route/service/repository، شريحة RLS رأسية، واختبارات عزل المستأجرين.
- `apps/web`: هيكل واجهة RTL بـ Mantine، i18n عربي/إنجليزي، صلاحيات دقيقة، وشاشات القائمة والنموذج والطباعة.
- `docs/C0-WORKING-PLAN.md`: تحليل المشروع وخطة تنفيذ C0.
- `AGENTS.md`: أوامر التشغيل وقيود البيئة المُتحقَّق منها.
- `docs/adr/0001-tenant-isolation-with-rls.md`: قرار العزل بـ RLS.

### أُصلح

- **`tools/TafqeetGoldenExport.bas`**: كان `CLng(parts(1))` يُنفَّذ قبل تسليح `On Error Resume Next`، وقائمة الحالات تحتوي `999999999999` أكبر من حد `Long`، فكان الماكرو ينهار بالخطأ 6 **دون إنتاج أي ملف**. استُبدل بـ `CDbl` (القيم متطابقة) فاكتمل التصدير.
- **`packages/words`**: عبارة الإغلاق («فقط») لم تبقَ جزءاً من ناتج التفقيط الافتراضي؛ صارت تُمرَّر صراحةً حيث يلزم التوافق مع وحدة VBA، حسب القرار المعتمد في `DESIGN.md` §6.
- **`packages/words`**: التحقق من `minorDigits` في `parseAmount`، وتحصين المقارنة الذهبية ضد ملف فارغ أو صف مبلغ غير صالح.
- **الوثائق**: تصحيح عدد حالات الماكرو (8,040 لا «نحو 7,000») وذكر المكرّرَين.
