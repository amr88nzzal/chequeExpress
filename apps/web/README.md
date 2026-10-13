# @cheques/web — واجهة إدارة الشيكات (RTL أولاً)

موكاب واجهة الويب لنظام إدارة الشيكات متعدد المستأجرين: شركة واحدة أو أكثر، حسابات بنكية، شيكات صادرة،
ومسار طباعة يتوقف على تأكيد الشيك الموضوع في الطابعة فعلاً.

> **⚠️ الشاشات تتحدث الآن إلى وحدة mock محلية، لا إلى `apps/api`.**
> التفاصيل وخطوات الاستبدال في قسم «الـ API الوهمي».

## المكدس

| الطبقة          | الاختيار                                            |
| --------------- | --------------------------------------------------- |
| البناء          | `Vite` 5 + `React` 18 + `TypeScript` (وضع `strict`) |
| المكوّنات       | `Mantine` 7 مع `DirectionProvider`                  |
| حالة الخادم     | `TanStack Query` 5                                  |
| النماذج         | `React Hook Form` + `Zod`                           |
| الترجمة         | `react-i18next` (عربي/إنجليزي)                      |
| الاختبار        | `Vitest` + `@testing-library/react` + `jsdom`       |
| الأرقام العشرية | `decimal.js` (لا `number` على أي مبلغ)              |

## التشغيل

```powershell
# من مجلد apps/web (لا يعتمد على مساحة العمل في الجذر بعد)
npm install --ignore-scripts --no-audit --no-fund --workspaces=false --cache <workspace>\.npm-cache

npm run dev          # خادم التطوير على http://localhost:5173
npm run build        # بناء الإنتاج إلى dist/
npm run test         # Vitest
npm run typecheck    # tsc --noEmit -p tsconfig.json
```

من جذر المستودع:

```powershell
npx vitest run apps/web                              # اختبارات هذه الحزمة
npx tsc --noEmit -p apps/web/tsconfig.json            # فحص الأنواع
npx eslint apps/web
npx prettier --check apps/web
```

### ⚠️ قيود صندوق حماية DSH على ويندوز

`vite` يبني ملف الإعداد بـ `esbuild`، و`esbuild` يشغّل خدمته بعملية فرعية بأنابيب `stdio`، وذلك ممنوع في
الصندوق (`spawn EPERM`). النتيجة على جهاز التطوير المحلي:

| الأمر                                     | الحالة محلياً                                      | البديل                                                               |
| ----------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| `npx vitest run apps/web`                 | يفشل عند تحميل `vitest.config.ts` بـ `spawn EPERM` | صلاحية موسّعة، أو محرّك الاختبار في القسم التالي، وفي CI يعمل مباشرة |
| `npm run build` (`vite build`)            | يفشل بالسبب نفسه                                   | صلاحية موسّعة أو CI                                                  |
| `npx tsc` · `npx eslint` · `npx prettier` | تعمل                                               | —                                                                    |

`node tools/run-tests-without-esbuild.mjs` يشغّل **ملفات الاختبار نفسها**: يترجم `src` و`test` إلى
JavaScript بـ `tsc` (وهو JavaScript صافٍ بلا عمليات فرعية)، ثم يبدأ `Vitest` برمجياً مع
`config: false` و`esbuild: false` و`resolve.preserveSymlinks`، فتصبح سلسلة التحويل غير لازمة. الملف
أداة محلية فقط، وغير مربوط بأي `npm script`، و CI لا يستعمله.

## الـ API الوهمي

كل ما تقرأه الشاشات يأتي من **وحدة واحدة**: `src/api/mock-api.ts`. لا مكوّن ولا `hook` يحمل بيانات تجريبية
بنفسه؛ البيانات كلها دالّة حتمية من الفهرس (بلا `Math.random` وبلا `new Date()`).

خطوات الاستبدال بـ `apps/api` (تغيير ملف واحد + ملف جديد):

1. أنشئ `src/api/http-api.ts` ينفّذ الواجهة `ApiClient` عبر `/api/v1` ويفكّ غلاف `{ data, meta }`
   (`CONVENTIONS.md` §13)، ويرسل `Idempotency-Key` على كل عملية تحجز رقماً أو تطبع.
2. بدّل السطر الوحيد في `src/api/client.ts`: `export const api: ApiClient = mockApi;`.
3. احذف `src/api/mock-api.ts` — لا شيء آخر يستوردها.

ما هو **وهمي** تحديداً:

- الشركات والحسابات البنكية والأطراف والطابعات (`COMPANIES`, `BANK_ACCOUNTS`, `PARTIES`, `PRINTERS`).
- `24` شيكاً صادراً موزّعة على الحالات الإحدى عشرة، مع ترقيم بمؤشر (`nextCursor`).
- المستخدم الحالي وصلاحياته (بذرة دور `admin`).
- `amountInWords: null` — التفقيط مسؤولية الخادم (`packages/words`) ولا يُولَّد في الواجهة.
- نتيجة تأكيد الطباعة: الوحدة تتحقق من لاحقة رقم الشيك كما يفعل الخادم، لكن التحقق الحقيقي في الخادم
  (`CONVENTIONS.md` §11).
- الإعدادات (`src/config/settings.ts`) وعملاتها وخانات كسورها (JOD = 3، USD = 2 …): في النظام الحقيقي
  تأتي مع ملف الشركة من الخادم.

## نموذج الصلاحيات

- **الاسم**: `cheques.<resource>.<action>` — مثل `cheques.issued.print`. الثوابت في
  `src/permissions/catalog.ts` (نظيرها المطلوب في `packages/shared`).
- **المنح**: الصلاحية + **النطاق** الذي مُنحت عليه:
  `{ kind: 'tenant' }` (كل الشركات) أو `{ kind: 'company', companyId }` أو `{ kind: 'bankAccount', … }`.
- **الأدوار بيانات لا كود**: `admin` و`issuer` و`follower` في `src/permissions/seed.ts` هي مجرد قوائم
  منح. لا يوجد في الواجهة أي `role === 'admin'`.
- **التنقل مشتق من الصلاحيات**: `visibleDestinations(grants, scope)` في `src/permissions/nav.ts` يعيد
  الوجهات المتاحة على النطاق النشط. ما لا صلاحية له لا يُرسم.
- **المسارات محمية كذلك**: `RequirePermission` يحوّل إلى `/403` ويحمل الصلاحية المطلوبة لعرضها. سجل خارج
  النطاق مسألة أخرى: الـ API يجيب `404` (`CONVENTIONS.md` §9).
- **حالتان من الصلاحيات في الكود**: `<Can permission={…}>` للإظهار/الإخفاء داخل شاشة، و
  `usePermissions()` لمنطق أوسع.
- **التحميل ليس 403**: قبل وصول المنح يعرض `RequirePermission` حالة تحميل؛ عرض `403` هنا وميض خاطئ.
- **مبدّل الشركة** يضيّق النطاق: صلاحية ممنوحة على شركة تختفي عند اختيار شركة أخرى.
- إضافة صلاحية جديدة = سطر في `catalog.ts` + سطر في `seed.ts` + ترجمة `permissions.…` + اختبار.

## قواعد RTL

- **خصائص CSS منطقية فقط**: `margin-inline-start`, `padding-inline`, `border-inline-start`,
  `text-align: start` — ولا `left`/`right` لأي تخطيط (`src/styles/app.css`).
- **الأيقونات الاتجاهية تنعكس** من السمة `dir` لا بنسختين من الأيقونة:
  `[dir='rtl'] .directional-icon { transform: scaleX(-1); }` — والأيقونات الرأسية لا تُنعكس.
- **الاتجاه من اللغة**: `directionForLanguage()` في `src/lib/language.ts`. مبدّل اللغة يغيّر
  `i18n` ويحفظ الاختيار في `localStorage` (`chequesExpress.language`)، و`AppProviders` يعيد ضبط
  `lang` و`dir` على `<html>`.
- **Mantine 7**: `DirectionProvider` يأخذ `initialDirection` و`detectDirection` (لا يوجد خاصية `dir`)،
  وكل مكوّنات v7 تحمل قواعد RTL داخل `styles.css` نفسه — لا يوجد ملف `styles.rtl.css` منفصل. الاتجاه
  الحيّ يُدفع عبر `useDirection().setDirection` في `DirectionProvider`.
- **الأرقام والعملات**: `font-variant-numeric: tabular-nums` و`unicode-bidi: isolate` للأرقام وأرقام
  الشيكات، بلا `dir` صلب على التخطيط.
- التخطيط كله بالمليمتر حيث يلزم (`152.4mm` في `.cheque-preview-sheet`).

## الترجمة (i18n)

- **لا نص عربي أو إنجليزي داخل مكوّن** — كل شيء عبر `t('…')` بمفاتيح هرمية.
- `src/i18n/locales/en.ts` هو المرجع، و`ar.ts` مُقيَّد بـ `typeof en`: مفتاح ناقص أو زائد في أي لغة
  **يُسقط `tsc`**. لا حاجة لاختبار يدوي لاكتمال الترجمة (وهناك اختبار يتحقق وقت التشغيل أيضاً).
- الاتفاقية: `الوحدة.الشاشة.العنصر`، وقيم الحالات تبقى `snake_case` إنجليزية في الكود والعربي في الترجمة
  فقط: `issued.status.pending_approval`.
- **أكواد أخطاء لا جمل**: مخططات `Zod` تُرجع رموزاً ثابتة (`AMOUNT_FRACTION_DIGITS`)، والمكوّن يترجمها
  بمفتاح (`draft.form.errors.amountFractionDigits`). هكذا يبقى المخطط نفسه صالحاً للخادم ولواجهة بأي لغة.
- مجموعات المفاتيح: `app` · `language` · `company` · `nav` · `common` · `issued.*` · `draft.*` ·
  `print.*` · `permissions.cheques.*` · `forbidden` · `notFound` · `error`.

### مفاتيح الحالات الإحدى عشرة

`issued.status.draft` · `pending_approval` · `approved` · `printing` · `printed` · `delivered` ·
`cashed` · `cancelled` · `damaged` · `lost` · `stopped` — والقائمة الواحدة في `CHEQUE_STATUSES`
(`src/api/types.ts`) هي التي تولّد خيارات المرشّح، فلا تُنسى حالة عند إضافة واحدة.

## الشاشات

| المسار              | الصلاحية                | ما تعرضه                                                                                                                               |
| ------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/issued`           | `cheques.issued.view`   | جدول قابل للترشيح (الحالة، تاريخ الاستحقاق من/إلى، الحساب، المستفيد)، ترقيم بمؤشر مع «تحميل المزيد»، تواريخ ومبالغ منسّقة من الإعدادات |
| `/issued/new`       | `cheques.issued.create` | نموذج `React Hook Form` + `Zod`، حقل المبلغ نص عشري بخانات كسر حسب العملة                                                              |
| `/print?chequeId=…` | `cheques.issued.print`  | الشيك، الطابعة، **آخر رقم شيك متوقع**، المعاينة، ثم تأكيد بكتابة آخر أربعة أرقام من الشيك الموضوع في الطابعة                           |
| `/403` · `*`        | —                       | غير مسموح · غير موجود                                                                                                                  |

## المال والتواريخ

- المبالغ **نصوص عشرية** من الـ API إلى النموذج إلى الجدول. التحقق والتقريب في `src/lib/money.ts`
  و`src/lib/format.ts` عبر `decimal.js` فقط؛ لا `Number` ولا `parseFloat` على مبلغ.
- خانات الكسر حسب العملة: `JOD` 3، `USD` 2 (جدول `currencies`). `"5.123"` مقبول لـ `JOD` و`"5.1234"`
  مرفوض.
- الأرقام العربية-الهندية (`٥٫١٢٣`) تُطبَّع إلى `5.123` قبل التحقق (`src/lib/digits.ts`).
- التواريخ من الإعدادات: تواريخ الأعمال (`issue_date`, `due_date`) بلا وقت وبلا منطقة وتُعرض مثبّتة على
  `UTC` كي لا ينزاح اليوم؛ اللحظات تُعرض بمنطقة الشركة (`Asia/Amman`).

## الاختبارات

```powershell
npm run test     # داخل apps/web
node tools/run-tests-without-esbuild.mjs   # البديل المحلي عند قيود الصندوق
```

| الملف                             | ما يغطيه                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `test/rtl-screen.test.ts`         | شاشة عربية بـ `dir="rtl"` وتسميات عربية (وأن المفاتيح الخام لا تظهر)                          |
| `test/language-toggle.test.ts`    | التحويل إلى الإنجليزية، انقلاب الاتجاه، وحفظ الاختيار                                         |
| `test/nav-permissions.test.ts`    | إخفاء وجهة عند غياب الصلاحية وإظهارها عند وجودها، حماية المسار، وعدم وميض `403` أثناء التحميل |
| `test/money-field.test.ts`        | `"5.123"` مقبول و`"5.1234"` مرفوض لـ `JOD`، و`USD` بخانتين، ورفض الأرقام والفواصل             |
| `test/print-confirmation.test.ts` | رفض لاحقة رقم الشيك غير المطابقة وقبول المطابقة (بما فيها الأرقام العربية-الهندية)            |
| `test/i18n-completeness.test.ts`  | تطابق مفاتيح اللغتين، وتغطية الحالات والصلاحيات ووجهات التنقل بالترجمة                        |

## البنية

```
apps/web
  index.html · vite.config.ts · vitest.config.ts · tsconfig.json
  src/
    main.tsx
    app/           app-root.tsx (التركيب الكامل) · providers.tsx · routes.tsx
    api/           types.ts · client.ts (المفصل الوحيد) · mock-api.ts (يُحذف) · query-keys.ts
    components/    app-shell.tsx · company-switcher.tsx · language-toggle.tsx · icons.tsx …
    config/        settings.ts · settings-context.tsx · currencies.ts
    features/      issued/ · drafts/ · printing/   (كل ميزة: components · pages · hooks · schema)
    hooks/         use-reference-data.ts
    i18n/          index.ts · locales/ar.ts · locales/en.ts
    lib/           money.ts · format.ts · digits.ts · language.ts · paths.ts · idempotency.ts
    permissions/   catalog.ts · seed.ts · check.ts · nav.ts · permissions-context.tsx · can.tsx …
    styles/        app.css
  test/            ستة ملفات اختبار + test-utils.tsx
  tools/           run-tests-without-esbuild.mjs (أداة صندوق الحماية فقط)
```

## ديون تقنية معلومة

- مخططات `Zod` محلية ومعلَّمة بـ `MIGRATION` في `src/features/drafts/schema/create-draft-schema.ts`
  و`src/features/printing/lib/confirmation-schema.ts`، ويجب أن تنتقل إلى `packages/shared` لتكون
  **نفس الكائن** الذي يتحقق به `apps/api`. الثوابت المماثلة: `PERMISSIONS` و`CHEQUE_STATUSES` و`Currency`.
- `amountInWords` وهمي (`null`) لأن `packages/words` حزمة خادم.
- `apps/api` غير جاهز، فكل شيء خلف `src/api/mock-api.ts`.
