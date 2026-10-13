# التفقيط — المقارنة الذهبية (بعد وصول `tafqeet_cases.csv`)

```
ضعت ملف `tafqeet_cases.csv` (من ماكرو `tools/TafqeetGoldenExport.bas`) في `packages/words/test/golden/jod-ar.csv`.
1. شغّل `node packages/words/tools/compare-golden.ts packages/words/test/golden/jod-ar.csv`.
2. صنّف الفروق إلى فئات (مثلاً: مائتا/مائتان قبل ألف، التنوين، صيغة الواحد والاثنين).
3. لكل فئة اعرض عليّ مثالين من وحدة VBA ومن حزمتنا، وبيّن أيهما الأصح لغوياً، واسألني أيهما نعتمد. لا تغيّر السلوك قبل قراري.
4. ما يُقبل يُوثَّق في `test/golden/known-differences.json`؛ وما يُرفض يُصلح في الحزمة مع اختبار دائم.
المعيار: الاختبار الذهبي أخضر بلا فروق غير موثّقة.
```
