import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function RecoveryGuide({
  view,
  needsSetup,
}: {
  view: "backups" | "updates";
  needsSetup: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {needsSetup && (
        <Alert>
          <AlertTitle>إعداد خدمة الصيانة مرة واحدة</AlertTitle>
          <AlertDescription>
            قد يحتاج الخادم المثبّت سابقًا إلى أدوات الصيانة الموقّعة الجديدة وإعداد مجلدات الوسائط
            وصلاحياتها عبر المشغّل المحلي. لا يمكن للتطبيق القديم تنفيذ هذه الخطوة بنفسه. بعد الإعداد
            تظهر العمليات التي يدعمها الخادم هنا؛ لا تُشغّل الصيانة من طرفين معًا.
          </AlertDescription>
        </Alert>
      )}
      <Collapsible>
        <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
          {view === "backups" ? "ما الذي أنسخه إلى USB؟ وكيف أستعيده؟" : "كيف يعمل التحديث؟"}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          {view === "backups" ? (
            <ol className="flex list-inside list-decimal flex-col gap-2 text-sm text-muted-foreground">
              <li>
                أنشئ نسخة يدوية وانتظر نجاح التحقق. انسخ مجلد النسخة المكتمل كاملًا من
                Nahhasio/data/backups، بما فيه البيان والبصمات وقاعدة البيانات والصور وإعدادات
                الاستعادة وجرد الفيديوهات وسجلات الاستيراد.
              </li>
              <li>
                انسخ Nahhasio/videos منفصلًا؛ النسخ اليومية لا تحتوي بايتات الفيديو. احتفظ بنسخة خاصة
                من Nahhasio/config وبسجلات Nahhasio/data/media-operations الأحدث. تتضمن الإعدادات كلمات
                مرور ومفاتيح ثقة؛ احمِ وسيط النسخ.
              </li>
              <li>
                إذا أردت متابعة رفع أو استيراد غير مكتمل فانسخ أيضًا Nahhasio/downloads
                وNahhasio/imports بعد إيقاف مهام الوسائط. المحذوفات اختيارية إذا أردت الاحتفاظ
                بإمكانية استعادتها.
              </li>
              <li>
                عند فقدان الجهاز: جهّز الخادم بنفس إصدار النسخة ومخططها، واستعد عبر أداة النقل
                الموثّقة. أعد الفيديوهات إلى جذورها ثم افحصها. لا تنسخ مجلد PostgreSQL أثناء تشغيله.
                الاستعادة العادية هنا تحفظ ثقة الخادم الحالي.
              </li>
            </ol>
          ) : (
            <ol className="flex list-inside list-decimal flex-col gap-2 text-sm text-muted-foreground">
              <li>
                التحديث المتوافق: إصدار موقّع ونسخة احتياطية ثم تبديل التطبيق وأدوات الصيانة وفحص
                الجاهزية. لا يغيّر مخطط قاعدة البيانات.
              </li>
              <li>
                ترقية المخطط: تأكيد الإصدار، إيقاف الكتابة، نسخة متحقّق منها، وترحيل نسخة منفصلة من
                قاعدة البيانات. تُراجع هوية الخادم والبيانات والصور قبل التبديل؛ تُحتفظ بالقاعدة
                السابقة للرجوع عند فشل الجاهزية.
              </li>
              <li>
                تحديث تطبيق الجهاز تديره Flatpak. ترقية PostgreSQL الرئيسية وتجهيز جهاز بديل عمليتان
                منفصلتان. لا تبدأ عملية أخرى إذا انقطع الاتصال؛ أعد الاتصال أولًا لمعرفة النتيجة.
              </li>
            </ol>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
