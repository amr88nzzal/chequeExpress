# AGENTS.md — أوامر التشغيل والبنية والمحظورات

هذا الملف موجز تشغيلي لمَن يعمل على المستودع (إنساناً أو وكيلاً). الوثائق في `docs/` هي المرجع، وعند أي تعارض **الوثائق هي الأصل**.

## أوامر التشغيل

```powershell
npm install --ignore-scripts --no-audit --no-fund   # إلزامي: انظر «قيود البيئة»
npm run verify                                       # أنواع + lint + تنسيق + اختبارات
npm run typecheck:root                               # فحص الأنواع للحزم المشتركة والخادم
npm run typecheck                                    # فحص الأنواع لكل حزمة على حِدة
npm test                                             # اختبارات الوحدة (Vitest)
npm run lint
npm run format:check
npm run dev --workspace @cheques/web                 # تشغيل الواجهة
```

اختبارات قاعدة البيانات تُتخطّى محلياً بلا `DATABASE_URL`، وتُشغَّل فعلياً في GitHub Actions:

```powershell
$env:DATABASE_URL = "postgres://...@127.0.0.1:5432/cheques_test"
npm run migrate --workspace @cheques/api
npm run test:isolation --workspace @cheques/api
```

## البنية وحدود الطبقات

```
apps/api        route → service → repository   (المعاملة في الـ service فقط)
apps/web        features/<name>/{api,components,pages,hooks}
packages/words  التفقيط — دوال نقية، بلا I/O، بلا اعتماديات تشغيلية
packages/cheque-render  توليد PDF بالمليمتر + تشكيل عربي
```

الاعتماد من الأعلى إلى الأسفل فقط، ووحدة لا تُستورد إلا عبر `index.ts` العامة. الحدود تفرضها `eslint-plugin-boundaries` (قيد مخطَّط، انظر `eslint.config.mjs`).

## المحظورات

- **لا `number` ولا floating point لمبلغ** في أي طبقة (قاعدة، خادم، واجهة، اختبار). الـ API نصوص عشرية.
- **لا جدول بيانات بلا `tenant_id` وRLS مفعّل ومُجبَر** ونقطة سياسة. الاختبار الفوقي في `apps/api` يفشل إن خالفت.
- **لا `UPDATE ... SET status`** خارج خدمة الانتقالات.
- **لا حذف** لسجلات الشيكات وحالاتها ووظائف الطباعة وسجل التدقيق.
- **لا نص عربي أو إنجليزي مكتوب داخل المكوّنات** — كل النصوص عبر i18n بمفاتيح هرمية.
- **لا `new Date()` في منطق العمل** — الساعة تُحقَن في `ctx.clock`.
- **لا أسرار ولا ملفات `.env` متتبَّعة**، ولا أرقام حسابات أو رموز في السجلات.
- **لا تعديل لـ `spikes/pdf-print-python`** — مرجع تاريخي (نموذج C0 الأولي)، والقرار المعتمد هو مكتبة PDF صافية في `packages/cheque-render`.

## قيود البيئة (مُتحقَّق منها فعلياً على جهاز التطوير)

هذه القيود تخصّ صندوق حماية DSH على Windows، وقد كلّفت تشخيصاً سابقاً — لا تُعِد اكتشافها:

| القيد | الأثر | البديل المعتمد |
|---|---|---|
| عمليات فرعية بأنابيب stdio ممنوعة (`spawn EPERM`) | `node --test` بمعامله الافتراضي يفشل، وVitest بـ `pool: 'forks'` يفشل | `pool: 'threads'` في `vitest.config.ts`، أو تشغيل ملف الاختبار مباشرة |
| `pnpm install` يفشل (`ERR_PNPM_STORE_DIR_OPEN_OPERATION_LOCK`) | لا pnpm workspaces محلياً | **npm workspaces** محلياً؛ pnpm يبقى الخيار في CI إن رغب الفريق |
| npm يستدعي lifecycle scripts بعملية فرعية | `npm install` يفشل بـ `EPERM` | `npm install --ignore-scripts` |
| الكتابة خارج مساحة العمل ممنوعة | `corepack enable`, `D:\`, `%APPDATA%`, `C:\Program Files` | كل الذاكن والـ store داخل مساحة العمل: `--cache .npm-cache` |
| git عبر HTTPS يفشل (`schannel: SEC_E_NO_CREDENTIALS`) وSSH غير مُصرَّح للمفتاح الحالي | لا `git fetch/push` من داخل الصندوق | الدفع من جلسة بصلاحية أوسع أو من جهاز صاحب المشروع |
| لا Docker ولا PostgreSQL ولا WSL عاملة | لا اختبار RLS ولا بناء arm64 محلياً | GitHub Actions (خدمة PostgreSQL + بناء الصور) |
| Playwright لا يعمل (تنزيل المتصفح وإطلاقه) | لا اختبار متصفح ولا توليد PDF بـ Chromium | `packages/cheque-render` بمكتبة PDF صافية، واختبارات DOM عبر jsdom |
| بيانات اعتماد GitHub | الرمز محفوظ في Windows Credential Manager (وليس في المستودع) | لا يُكتب في أي ملف ولا يُطبع في أي مخرَج |

## النشر

سيرفر خاص بـ Docker Compose، معمارية **arm64**. بيئتان على الأقل: Staging وProduction، والنشر عبر GitHub Actions وSSH. (لم يُبنَ بعد، ضمن المراحل اللاحقة في `docs/PLAN.md`.)
