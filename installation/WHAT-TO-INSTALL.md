# What to install alongside Pharmacy POS

**Short answer: nothing.** Install the app and you are done. Do not install MongoDB, Node.js, Java,
.NET, Python, or any database driver. All of it is inside the installer.

## The PC needs

- Windows 10 (64-bit, 1809 or later) or Windows 11 (64-bit).
- 4 GB RAM (8 GB recommended), about 1.5 GB free disk for the app, and 2 GB or more for data and backups.
- Port **27028** free on this PC. The bundled database listens on `127.0.0.1` only.
- A normal Windows user account. No administrator rights are needed.
- No internet connection is needed to install, activate, or use the app.

## Already inside the installer (do not install separately)

- The program itself (Electron 45.2.1 with its browser and runtime).
- MongoDB Community Server 9.0.8, started and stopped by the app.
- The Microsoft Visual C++ runtime files the database needs.
- English and Arabic screens, both included.

## Optional hardware (only if the pharmacy uses it)

- Receipt printer: any printer already installed in Windows. The app uses the normal Windows print dialog.
- Barcode scanner: a USB scanner in "keyboard wedge" mode. No driver or setup inside the app.

## Two things to expect on the test PC

1. **SmartScreen warning.** The test build is not code-signed. Verify the SHA-256 in `SHA256SUMS.txt`,
   then choose **More info → Run anyway**.
2. **License step.** On first start the app shows a **Device code**. Send that 32-character code to the
   seller, paste the license code you get back, and press **Activate**. Field-test licenses can last 1 hour; normal subscriptions last 30 days.
   No internet is needed for this step.

Never delete `%APPDATA%\pharmacy-pos-management\mongodb-auth.bin`. It is the key to the local database.

---

<div dir="rtl">

# ما يجب تثبيته بجانب برنامج الصيدلية

**باختصار: لا شيء.** ثبّت البرنامج فقط. لا تثبّت MongoDB ولا Node.js ولا Java ولا .NET ولا Python
ولا أي برنامج قاعدة بيانات؛ كل ذلك موجود داخل ملف التثبيت.

## ما يحتاجه الجهاز

- ويندوز 10 (64-بت، إصدار 1809 أو أحدث) أو ويندوز 11 (64-بت).
- ذاكرة 4 جيجابايت (يُفضّل 8)، ومساحة حوالي 1.5 جيجابايت للبرنامج، و2 جيجابايت أو أكثر للبيانات والنسخ.
- المنفذ **27028** غير مستخدم على هذا الجهاز. قاعدة البيانات المدمجة تعمل على `127.0.0.1` فقط.
- حساب ويندوز عادي. لا حاجة لصلاحيات المدير.
- لا حاجة لاتصال بالإنترنت للتثبيت أو التفعيل أو الاستخدام.

## موجود داخل ملف التثبيت (لا تثبّته منفصلًا)

- البرنامج نفسه (Electron 45.2.1 مع المتصفح وبيئة التشغيل).
- MongoDB Community Server 9.0.8، ويشغّله ويوقفه البرنامج.
- ملفات Microsoft Visual C++ التي تحتاجها قاعدة البيانات.
- الشاشات العربية والإنجليزية، كلتاهما مضمّنة.

## أجهزة اختيارية (فقط إذا كانت الصيدلية تستخدمها)

- طابعة إيصالات: أي طابعة مثبّتة في ويندوز. البرنامج يستخدم نافذة الطباعة العادية.
- ماسح باركود: ماسح USB بوضع "لوحة المفاتيح" (keyboard wedge). لا يحتاج تعريفًا داخل البرنامج.

## أمران متوقعان على جهاز الاختبار

1. **تحذير SmartScreen.** النسخة التجريبية غير موقّعة رقميًا. تحقّق من بصمة SHA-256 في
   `SHA256SUMS.txt`، ثم اختر **More info → Run anyway**.
2. **خطوة الترخيص.** عند أول تشغيل يظهر **كود الجهاز**. أرسل هذا الكود (32 حرفًا) إلى البائع،
   والصق كود الترخيص الذي يصلك، ثم اضغط **تفعيل**. ترخيص التجربة صالح 30 يومًا، ولا يحتاج إنترنت.

لا تحذف الملف `%APPDATA%\pharmacy-pos-management\mongodb-auth.bin`؛ فهو مفتاح قاعدة البيانات المحلية.

</div>
