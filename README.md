# Freebuff RTL Injector

**English | [فارسی](#فارسی) | [العربية](#العربية)**

A standalone, source-untouched injector that adds **RTL (Right-to-Left)**
support — Persian/Farsi, Arabic, Hebrew, Urdu, etc. — to
[**Freebuff Desktop**](https://github.com/CodebuffAI/freebuff), the free
desktop app for [Codebuff](https://codebuff.com), the free/open-source
AI coding agent. Freebuff's UI currently has no RTL awareness, so
Persian/Arabic text renders left-aligned and visually broken. This project
fixes that **without modifying or forking Freebuff's own source code** —
in the same spirit as BetterDiscord or Vencord: one tiny hook is added to
the installed app, and all the actual styling/logic lives in separate,
freely-editable files.

> Freebuff itself: **https://github.com/CodebuffAI/freebuff** (Apache-2.0
> license). This repository is an unofficial, third-party add-on and is
> not affiliated with or endorsed by Codebuff/Freebuff.

---

## How it works

Freebuff Desktop is Electron-based. Its `main.cjs` loads the whole UI
from a local HTTP server it spawns itself
(`http://127.0.0.1:<port>/`) — there's no static `index.html`/CSS inside
`app.asar` to patch directly. So instead:

1. A **6-line hook** is inserted into `electron/main.cjs` **inside**
   `app.asar`, right after the window's `did-finish-load` event is wired
   up. This is the only thing that ever touches Freebuff's own files, and
   it's applied by a script — never done by hand, and always reversible.
2. That hook `require()`s a **loader** that lives *outside* `app.asar`, in
   your OS's per-app data folder. The loader injects CSS and JavaScript
   into the already-loaded page using Electron's own
   `webContents.insertCSS` / `executeJavaScript` — the same mechanism
   Freebuff's own code could use, just from a separate file.
3. The actual RTL logic (`mod/rtl.css`, `mod/rtl.js`) auto-detects
   Persian/Arabic/Hebrew Unicode ranges in the page's text at runtime and
   tags those elements for right-to-left rendering — code blocks,
   terminal panes, file paths, and URLs are deliberately kept
   left-to-right even inside RTL text, since Freebuff is a coding tool.

Because the mod files live outside the asar, **editing them never
requires re-patching** — just restart Freebuff (or let it hot-reload).

---

## Install

Requires [Node.js](https://nodejs.org) (any recent LTS). No Freebuff
source checkout needed — this works against your normal, already-installed
copy of Freebuff Desktop.

```bash
git clone https://github.com/mahbodam/freebuff-rtl-injector.git
cd freebuff-rtl-injector
node scripts/patch-asar.mjs
```

Or, even simpler — just double-click / run the helper script for your OS:

- **Windows** → double-click `freebuffrtl.bat`
- **macOS / Linux** → `chmod +x freebuffrtl.sh && ./freebuffrtl.sh` (only
  need `chmod +x` the first time)

The script auto-detects `app.asar` on all three platforms, including
common alternate install-folder names. If it can't find it, pass the path
explicitly:

```bash
node scripts/patch-asar.mjs "/full/path/to/app.asar"
```

| OS | Typical path the script looks for |
|---|---|
| Windows | `%LOCALAPPDATA%\Programs\@codebufffreebuff-desktop\resources\app.asar` (also scans `%LOCALAPPDATA%\Programs\*freebuff*`) |
| macOS | `/Applications/Freebuff.app/Contents/Resources/app.asar` (also scans `/Applications/*freebuff*.app`) |
| Linux | `/opt/Freebuff/resources/app.asar`, `~/.local/share/Freebuff/resources/app.asar` (also scans those dirs for `*freebuff*`) |

**Linux AppImage:** extract it first, since AppImages mount read-only:

```bash
./Freebuff.AppImage --appimage-extract
node scripts/patch-asar.mjs "$(pwd)/squashfs-root/resources/app.asar"
```

Quit and reopen Freebuff. Persian/Arabic text should now render
right-aligned with correct bidi handling, while code stays LTR.

---

## After every Freebuff update ⚠️

**Freebuff updates very frequently**, and its auto-updater replaces
`app.asar` completely on every update — which removes the hook (your
`mod/` files are untouched, since they live outside the asar). **You must
re-run the patch after each Freebuff update:**

```bash
node scripts/patch-asar.mjs
```

or just re-run `freebuffrtl.bat` / `freebuffrtl.sh`. It's idempotent and
safe to run as many times as you like, updated or not.

---

## Uninstall / restore original Freebuff

```bash
node scripts/uninstall.mjs
```

Restores `app.asar` from the pristine backup the patch script made on
first run (`app.asar.bak`, next to `app.asar`), and removes the mod
folder. If you've deleted that `.bak` yourself, just reinstall Freebuff.

---

## Configuring / customizing the mod

Everything under `loader/mod/` (installed into your OS's Freebuff
`userData` folder) is loaded fresh on every launch — no build step.

Edit `mod/config.json`:

```json
{
  "enabled": true,
  "mode": "auto",
  "forceDir": null
}
```

- `enabled: false` — turn off RTL injection without re-patching.
- `forceDir: "rtl"` / `"ltr"` — force a direction everywhere instead of
  automatic per-element detection.
- `mode: "auto"` (default, recommended) — detects direction per text
  block using Unicode-range heuristics; works even though Freebuff's UI
  build isn't available to inspect ahead of time.

`<userData>` locations:
- Windows: `%APPDATA%\Freebuff\freebuff-rtl\`
- macOS: `~/Library/Application Support/Freebuff/freebuff-rtl/`
- Linux: `~/.config/Freebuff/freebuff-rtl/`

If some specific part of the UI still looks off, open Freebuff's
DevTools (`Ctrl+Shift+I` / `Cmd+Option+I`), inspect the real element,
and add a targeted rule to the **`SITE-SPECIFIC OVERRIDES`** section at
the bottom of `mod/rtl.css` — the generic rules above it are
structure-agnostic and shouldn't need touching across Freebuff updates.

---

## Safety notes

- This never sends your data anywhere, doesn't touch the Bun orchestrator
  process, your API keys, or network traffic — it only affects how the
  already-rendered page looks.
- It only modifies a local `app.asar` file the exact same way Freebuff's
  own updater already does on every update.
- Use at your own risk, against a copy of Freebuff you installed
  yourself, consistent with Freebuff's own terms.

## Contributing

Issues and PRs welcome — especially real, inspected CSS selectors for
`mod/rtl.css`'s override section once you've used Freebuff with RTL text
for a while and spotted something the generic rules miss.

## License

MIT for this repository's own code. Freebuff itself is licensed
Apache-2.0 by Codebuff, Inc. — see
[CodebuffAI/freebuff](https://github.com/CodebuffAI/freebuff).

---
---

## فارسی

یک **افزونه‌ی مستقل** که بدون دست‌کاری یا فورک‌کردن سورس
[**Freebuff Desktop**](https://github.com/CodebuffAI/freebuff)
(نسخه‌ی رایگان [Codebuff](https://codebuff.com)، دستیار کدنویسی هوش
مصنوعی متن‌باز)، پشتیبانی از **راست‌چین (RTL)** — فارسی، عربی، عبری و
غیره — رو بهش اضافه می‌کنه. Freebuff فعلاً هیچ آگاهی‌ای از RTL نداره، پس
متن فارسی/عربی چپ‌چین و بهم‌ریخته نمایش داده می‌شه. این پروژه دقیقاً به
همون سبک BetterDiscord یا Vencord کار می‌کنه: فقط یک هوک کوچیک به برنامه‌ی
نصب‌شده اضافه می‌شه و تمام منطق واقعی استایل/جاوااسکریپت در فایل‌های
جدا و کاملاً قابل‌ویرایش قرار داره.

> ریپوی اصلی Freebuff: **https://github.com/CodebuffAI/freebuff**
> (لایسنس Apache-2.0). این ریپو یک افزونه‌ی غیررسمی شخص‌ثالث هست و
> هیچ ارتباطی با تیم Codebuff/Freebuff نداره.

### چطور کار می‌کنه

Freebuff Desktop بر پایه‌ی Electron هست. کل رابط کاربری‌اش از یک سرور
HTTP محلی که خودش بالا میاره لود می‌شه، نه از یک فایل HTML ثابت داخل
`app.asar` — پس امکان پچ مستقیم UI وجود نداره. به‌جاش:

1. یک **هوک ۶ خطی** داخل `electron/main.cjs` (که داخل `app.asar` هست)
   درست بعد از رویداد `did-finish-load` پنجره اضافه می‌شه. این تنها
   جایی هست که فایل اصلی Freebuff تغییر می‌کنه، و همیشه توسط اسکریپت
   انجام می‌شه (نه دستی) و کاملاً قابل‌برگشته.
2. اون هوک یک **لودر** رو صدا می‌زنه که *بیرون* از `app.asar`، در پوشه‌ی
   داده‌ی اپلیکیشن سیستم‌عامل شما، قرار داره. لودر با همون ابزار خود
   Electron (`insertCSS` / `executeJavaScript`) کد CSS و JS رو داخل
   صفحه‌ی لود‌شده تزریق می‌کنه.
3. منطق واقعی RTL (`mod/rtl.css` و `mod/rtl.js`) به‌صورت خودکار محدوده‌ی
   یونیکد فارسی/عربی/عبری رو در متن صفحه تشخیص می‌ده و اون بخش‌ها رو
   راست‌چین می‌کنه — بلوک‌های کد، ترمینال، مسیر فایل‌ها و URL‌ها عمداً
   همیشه چپ‌چین می‌مونن، چون Freebuff یک ابزار کدنویسیه.

چون فایل‌های افزونه بیرون از asar هستن، **ویرایش‌شون هیچ‌وقت نیاز به
پچ مجدد نداره** — فقط کافیه Freebuff رو ری‌استارت کنی.

### نصب

نیاز به [Node.js](https://nodejs.org) داری (هر نسخه‌ی LTS جدید).

```bash
git clone https://github.com/mahbodam/freebuff-rtl-injector.git
cd freebuff-rtl-injector
node scripts/patch-asar.mjs
```

یا ساده‌تر، اسکریپت مخصوص سیستم‌عاملت رو اجرا کن:

- **ویندوز** → دابل‌کلیک روی `freebuffrtl.bat`
- **مک/لینوکس** → `chmod +x freebuffrtl.sh && ./freebuffrtl.sh`
  (فقط بار اول نیاز به `chmod +x` هست)

اسکریپت خودش مسیر `app.asar` رو روی هر سه سیستم‌عامل پیدا می‌کنه (حتی
اگه اسم پوشه‌ی نصب استاندارد نباشه). اگه پیدا نکرد، مسیر رو مستقیم بده:

```bash
node scripts/patch-asar.mjs "/full/path/to/app.asar"
```

بعد از اجرا، Freebuff رو کامل ببند و دوباره باز کن.

### ⚠️ بعد از هر آپدیت Freebuff

**Freebuff خیلی زیاد و مکرر آپدیت می‌شه**، و هر بار کل `app.asar` رو
عوض می‌کنه — یعنی هوک پاک می‌شه (فایل‌های `mod/` دست‌نخورده می‌مونن).
**باید بعد از هر آپدیت دوباره پچ رو بزنی:**

```bash
node scripts/patch-asar.mjs
```

یا فقط دوباره `freebuffrtl.bat` / `freebuffrtl.sh` رو اجرا کن. کاملاً
بی‌خطره، هر چندبار هم که بزنیش مشکلی پیش نمیاد.

### حذف / برگشت به حالت اول

```bash
node scripts/uninstall.mjs
```

Freebuff رو از روی بکاپ اصلی (`app.asar.bak`) به حالت اولش برمی‌گردونه.

### شخصی‌سازی

فایل `mod/config.json` (داخل پوشه‌ی userData سیستم‌عاملت):

```json
{
  "enabled": true,
  "mode": "auto",
  "forceDir": null
}
```

- `enabled: false` — غیرفعال کردن بدون نیاز به پچ مجدد
- `forceDir: "rtl"` یا `"ltr"` — اجباری کردن جهت در همه‌جا

مسیر `userData`:
- ویندوز: `%APPDATA%\Freebuff\freebuff-rtl\`
- مک: `~/Library/Application Support/Freebuff/freebuff-rtl/`
- لینوکس: `~/.config/Freebuff/freebuff-rtl/`

اگه جایی از UI هنوز درست نشد، با DevTools (`Ctrl+Shift+I`) کلاس واقعی
اون المنت رو پیدا کن و به بخش `SITE-SPECIFIC OVERRIDES` در
`mod/rtl.css` اضافه کن.

---
---

## العربية

أداة **حقن مستقلة** تضيف دعم **الكتابة من اليمين لليسار (RTL)** —
الفارسية والعربية والعبرية وغيرها — إلى
[**Freebuff Desktop**](https://github.com/CodebuffAI/freebuff)، النسخة
المجانية من [Codebuff](https://codebuff.com)، مساعد البرمجة بالذكاء
الاصطناعي مفتوح المصدر، **دون تعديل أو تفريع الكود المصدري لـ Freebuff
على الإطلاق**. حالياً لا يدعم Freebuff اتجاه RTL، لذا يظهر النص
العربي/الفارسي بمحاذاة يسار وبشكل غير صحيح بصرياً. يعمل هذا المشروع
بنفس أسلوب BetterDiscord أو Vencord: يُضاف "هوك" (hook) صغير جداً إلى
التطبيق المثبَّت، بينما يبقى كل منطق التنسيق والجافاسكريبت الفعلي في
ملفات منفصلة قابلة للتعديل بحرية.

> مستودع Freebuff الأصلي: **https://github.com/CodebuffAI/freebuff**
> (رخصة Apache-2.0). هذا المستودع إضافة غير رسمية من طرف ثالث وغير
> تابع لفريق Codebuff/Freebuff ولا معتمد منه.

### كيف يعمل

يعتمد Freebuff Desktop على Electron. تُحمَّل واجهة المستخدم بالكامل من
خادم HTTP محلي يُشغّله التطبيق نفسه، وليس من ملف HTML ثابت داخل
`app.asar` — لذا لا يمكن التعديل المباشر على الواجهة. بدلاً من ذلك:

1. تتم إضافة **هوك من 6 أسطر فقط** داخل `electron/main.cjs` (الموجود
   داخل `app.asar`) مباشرة بعد ربط حدث `did-finish-load` للنافذة. هذا
   هو الجزء الوحيد الذي يمسّ ملفات Freebuff الأصلية، ويتم دائماً عبر
   سكريبت (وليس يدوياً)، وقابل للتراجع بالكامل.
2. يستدعي هذا الهوك **محمِّلاً (loader)** يعيش *خارج* `app.asar`، في
   مجلد بيانات التطبيق الخاص بنظام تشغيلك. يقوم المحمِّل بحقن CSS
   وJavaScript داخل الصفحة المحمَّلة باستخدام أدوات Electron نفسها
   (`insertCSS` / `executeJavaScript`).
3. منطق RTL الفعلي (`mod/rtl.css` و `mod/rtl.js`) يكتشف تلقائياً نطاقات
   يونيكود الفارسية/العربية/العبرية في نص الصفحة أثناء التشغيل، ويُعلّم
   تلك العناصر للعرض من اليمين لليسار — بينما تبقى كتل الأكواد والطرفية
   (terminal) ومسارات الملفات والروابط دائماً من اليسار لليمين عمداً،
   لأن Freebuff أداة برمجة.

بما أن ملفات الإضافة موجودة خارج `app.asar`، **تعديلها لا يتطلب أبداً
إعادة الحقن** — فقط أعد تشغيل Freebuff.

### التثبيت

يتطلب [Node.js](https://nodejs.org) (أي إصدار LTS حديث).

```bash
git clone https://github.com/mahbodam/freebuff-rtl-injector.git
cd freebuff-rtl-injector
node scripts/patch-asar.mjs
```

أو ببساطة أكبر، شغّل السكريبت الخاص بنظام تشغيلك:

- **ويندوز** ← انقر نقراً مزدوجاً على `freebuffrtl.bat`
- **ماك/لينكس** ← `chmod +x freebuffrtl.sh && ./freebuffrtl.sh`
  (تحتاج `chmod +x` مرة واحدة فقط)

يكتشف السكريبت مسار `app.asar` تلقائياً على الأنظمة الثلاثة. إذا لم
يجده، مرّر المسار مباشرة:

```bash
node scripts/patch-asar.mjs "/full/path/to/app.asar"
```

أغلق Freebuff بالكامل ثم أعد فتحه.

### ⚠️ بعد كل تحديث لـ Freebuff

**يتحدّث Freebuff بشكل متكرر جداً**، ويستبدل المحدِّث التلقائي فيه ملف
`app.asar` بالكامل في كل مرة — مما يزيل الهوك (ملفات `mod/` تبقى كما
هي، لأنها خارج الـ asar). **يجب إعادة تشغيل سكريبت الحقن بعد كل
تحديث:**

```bash
node scripts/patch-asar.mjs
```

أو فقط أعد تشغيل `freebuffrtl.bat` / `freebuffrtl.sh`. آمن تماماً مهما
كررت تشغيله.

### إلغاء التثبيت / الاستعادة

```bash
node scripts/uninstall.mjs
```

يستعيد `app.asar` الأصلي من النسخة الاحتياطية (`app.asar.bak`).

### التخصيص

ملف `mod/config.json`:

```json
{
  "enabled": true,
  "mode": "auto",
  "forceDir": null
}
```

مواقع `userData`:
- ويندوز: `%APPDATA%\Freebuff\freebuff-rtl\`
- ماك: `~/Library/Application Support/Freebuff/freebuff-rtl/`
- لينكس: `~/.config/Freebuff/freebuff-rtl/`

إذا بقي جزء معين من الواجهة غير صحيح، افتح أدوات المطوّر في Freebuff
(`Ctrl+Shift+I`)، افحص العنصر الفعلي، وأضف قاعدة مخصصة في قسم
`SITE-SPECIFIC OVERRIDES` أسفل `mod/rtl.css`.
