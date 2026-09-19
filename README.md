# أداة الأصناف والمخزون

موقع لمطابقة قائمة أصناف مطلوبة مع المخزون. **كتالوج الأصناف (7,553 صنف) مخزّن داخل الموقع** — البحث والاقتراحات تشتغل فوراً بدون رفع أي ملف. معالجة الملفات تتم بالكامل داخل متصفح المستخدم — لا ترفع لأي سيرفر. الجزء الوحيد الذي يستخدم السيرفر هو نموذج الملاحظات ولوحة الأدمن.

## مصدرا البيانات
| المصدر | الوصف | يتغيّر؟ |
|---|---|---|
| **الكتالوج** (`catalog.js`) | 7,553 صنف بأسمائها وأرقامها، مدمجة بالموقع | ثابت — يُحدَّث بتبديل الملف فقط |
| **المخزون** | مصدر الكميات المعروضة بصفحة المطابقة | الكتالوج افتراضياً، أو ملف مرفوع، أو صفوف الإدخال اليدوي |

الفصل بينهما مقصود: تغيير مصدر المخزون لا يعطّل بحث الكتالوج أبداً.

## الصفحات
| الصفحة | الوصف |
|---|---|
| الرئيسية | نقطة دخول للأقسام |
| مطابقة الأصناف | رفع المخزون + قائمة الطلبات → تقرير مطابقة قابل للتعديل والتصدير |
| إدخال يدوي | إدخال أصناف صف بصف مع اقتراحات فورية من الكتالوج المخزّن (تعمل من أول لحظة، بدون رفع ملف) |
| ملاحظات ومشاكل | نموذج عام، يخزَّن بقاعدة D1 |
| `/admin.html` | لوحة الأدمن (محمية بـ Cloudflare Access) — عرض/فلترة/تعليم كمقروء/حذف/تصدير إكسل |

## البحث (بنمط D365 F&O)
- **نص**: `فستق براف` → يظهر كل صنف يحتوي الكلمتين معاً
- **وايلد كارد**: `*فستق*براف*` → يحتوي "فستق" ثم "براف" بهذا الترتيب
- **رقم**: `319008` → بحث برقم الصنف (البادئة أولاً، ثم أي تطابق جزئي)
- الأسهم ↑↓ للتنقل، Enter للاختيار، Esc للإغلاق

## بنية الملفات
```
index.html                        الموقع الرئيسي
catalog.js                        كتالوج الأصناف المخزّن (7,553 صنف)
admin.html                        لوحة الأدمن
schema.sql                        سكيمة قاعدة البيانات
functions/api/feedback.js         POST عام لاستقبال الملاحظات
functions/api/admin/feedback.js   GET/PATCH/DELETE للأدمن فقط
```

---

## تحديث كتالوج الأصناف
لما تصدّر ملف أصناف جديد من D365، ولّد `catalog.js` من جديد:

```bash
python3 - << 'PY'
import pandas as pd, json
df = pd.read_excel('DynamicsExport.xlsx')          # غيّر اسم الملف
df = df[['Item number','Product name']].copy()
df['Item number']  = df['Item number'].astype(str).str.strip()
df['Product name'] = df['Product name'].astype(str).str.strip()
df = df[(df['Product name'] != '') & (df['Product name'].str.lower() != 'nan')]
df = df.drop_duplicates(subset=['Item number'], keep='first')
data = [[r['Item number'], r['Product name']] for _, r in df.iterrows()]
open('catalog.js','w',encoding='utf-8').write(
    'window.ITEM_CATALOG=' + json.dumps(data, ensure_ascii=False, separators=(',',':')) + ';')
print('عدد الأصناف:', len(data))
PY

git add catalog.js && git commit -m "تحديث كتالوج الأصناف" && git push
```
Cloudflare Pages ينشر التحديث تلقائياً خلال أقل من دقيقة.

---

## خطوات النشر

### 1) رفع المشروع على GitHub
```bash
git init
git add .
git commit -m "أداة الأصناف والمخزون"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

### 2) إنشاء قاعدة بيانات D1
من جهازك (تحتاج Node.js):
```bash
npx wrangler login
npx wrangler d1 create items-feedback
```
انسخ الـ `database_id` الذي يظهر، ثم طبّق السكيمة:
```bash
npx wrangler d1 execute items-feedback --remote --file=./schema.sql
```

### 3) إنشاء مشروع Cloudflare Pages
1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. اختر الريبو
3. إعدادات البناء:
   - Framework preset: **None**
   - Build command: (فارغ)
   - Build output directory: `/`
4. **Save and Deploy**

### 4) ربط قاعدة البيانات بالمشروع
في صفحة مشروع Pages → **Settings** → **Bindings** → **Add** → **D1 database**:
- Variable name: `DB`  ← **مهم أن يكون بهذا الاسم بالضبط**
- D1 database: `items-feedback`

أضفه لبيئتي **Production** و **Preview**، ثم أعد النشر (**Deployments** → **Retry deployment**).

### 5) حماية لوحة الأدمن بـ Cloudflare Access
1. [one.dash.cloudflare.com](https://one.dash.cloudflare.com) → **Access** → **Applications** → **Add an application** → **Self-hosted**
2. الإعدادات:
   - Application name: `Items Admin`
   - Session duration: حسب رغبتك (مثلاً 24 hours)
   - Public hostname: دومين موقعك، والمسار `admin.html`
3. أضف تطبيقاً ثانياً بنفس الطريقة للمسار `api/admin` (لحماية الـ API نفسه، لا الواجهة فقط)
4. في **Policies** لكل تطبيق:
   - Policy name: `Admin only`
   - Action: **Allow**
   - Include → **Emails** → اكتب إيميلك
5. **Save**

بعدها أي محاولة فتح `/admin.html` تحوّلك لصفحة تسجيل دخول Cloudflare (كود لمرة واحدة على إيميلك)، ولا يمر غير الإيميل المصرّح له.

> **ملاحظة أمنية:** لا تتخطَّ الخطوة 5. بدون Access، مسار `/api/admin/*` سيرفض الطلبات (يرجع 401 لأنه لا يجد ترويسة Access) لكن الاعتماد على ذلك وحده ليس سياسة أمان — فعّل Access فعلياً.

---

## التطوير محلياً
```bash
npm install -g wrangler
npx wrangler d1 execute items-feedback --local --file=./schema.sql
npx wrangler pages dev . --d1 DB=items-feedback
```
لتجربة لوحة الأدمن محلياً (بدون Access)، أضف متغيّر البيئة:
```bash
npx wrangler pages dev . --d1 DB=items-feedback --binding ALLOW_INSECURE_ADMIN=true
```
**لا تضع `ALLOW_INSECURE_ADMIN` في بيئة الإنتاج إطلاقاً.**

---

## تكلفة التشغيل
كل ما سبق ضمن الباقة المجانية من Cloudflare:
- Pages: نشر غير محدود، 500 بناء/شهر
- D1: 5 جيجا تخزين، 5 مليون قراءة/يوم
- Access: حتى 50 مستخدم مجاناً
