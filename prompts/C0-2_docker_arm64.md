# C0 — المهمة 2: Docker Compose على arm64 + النشر

```
المتطلبات مني (أنشئ لي قائمة بما تحتاجه بدل أن تخمّن): عنوان السيرفر وSSH، نظام التشغيل، إصدار Docker، النطاق وخطة TLS.
نفّذ:
- `infra/docker-compose` بخدمات: postgres، api، worker (+render)، gateway (Nginx) حسب `CONVENTIONS.md` القسم 16.
- صور متعددة المعمارية (arm64 + amd64) مع أولوية arm64.
- سكربت نشر عبر SSH: سحب الصور ← تهجير القاعدة (خطوة مستقلة) ← إعادة تشغيل بفحوص `/health/ready`.
- لا أسرار في Git: ملفات `.env` على السيرفر فقط، و`.env.example` في المستودع.
المعيار: Staging على السيرفر يخدم `/health/live` و`/health/ready`. أثبت ذلك بمخرجات فعلية.
```
