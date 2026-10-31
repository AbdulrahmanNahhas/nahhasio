import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { SettingsPanel, SettingsRow } from "./settings-controls";
import type { sections } from "./settings-model";

type Section = (typeof sections)[number]["id"];
type PlannedControl = {
  id: string;
  label: string;
  description: string;
  kind: "toggle" | "select" | "text" | "number" | "action";
};
type PlannedGroup = {
  section: Section;
  title: string;
  description: string;
  controls: PlannedControl[];
};

// This is a UI inventory, not stored preferences. Each control stays disabled until its
// service, ownership, migration and acceptance checks exist. No placeholder invokes the bridge.
const plannedGroups: PlannedGroup[] = [
  {
    section: "account",
    title: "الأجهزة وأمان الحساب",
    description: "تفضيلات الحساب وإدارة الوصول؛ لا تُغيّر هذه المعاينة جلساتك الحالية.",
    controls: [
      // TODO(settings-device-name): Persist a user-editable name for the registered device.
      {
        id: "device-name",
        label: "اسم هذا الجهاز",
        description: "تمييز هذا الجهاز في قائمة الجلسات.",
        kind: "text",
      },
      // TODO(settings-device-sessions): Connect the account-owned session/device listing and revocation services.
      {
        id: "device-sessions",
        label: "إدارة الجلسات والأجهزة",
        description: "عرض النشاط وإلغاء وصول جهاز محدد.",
        kind: "action",
      },
      // TODO(settings-revoke-others): Add a reviewed, server-enforced revoke-other-sessions action.
      {
        id: "revoke-others",
        label: "تسجيل الخروج من الأجهزة الأخرى",
        description: "إلغاء الجلسات الأخرى بعد مراجعتها.",
        kind: "action",
      },
      // TODO(settings-account-recovery): Implement account recovery before exposing recovery settings.
      {
        id: "account-recovery",
        label: "استرداد الحساب",
        description: "وسيلة استرداد موثوقة عند فقدان الوصول.",
        kind: "action",
      },
      // TODO(settings-viewing-profiles): Decide and implement viewing profiles independently of login accounts.
      {
        id: "viewing-profiles",
        label: "ملفات المشاهدة",
        description: "مستقبلي: ملفات مستقلة للتفضيلات والتتبع؛ يحتاج قرارًا وتنفيذًا منفصلين.",
        kind: "action",
      },
    ],
  },
  {
    section: "appearance",
    title: "واجهة التطبيق",
    description: "المظهر ولغة التطبيق وحجم النص.",
    controls: [
      // TODO(settings-theme): Persist an account/device theme and implement light/system palettes.
      {
        id: "theme",
        label: "المظهر",
        description: "داكن أو فاتح أو متابعة مظهر النظام.",
        kind: "select",
      },
      // TODO(settings-ui-language): Add translated client strings and language/direction selection.
      {
        id: "ui-language",
        label: "لغة الواجهة",
        description: "العربية أولًا، مع واجهة إنجليزية مكتملة لاحقًا.",
        kind: "select",
      },
      // TODO(settings-ui-scale): Implement accessible text/interface scaling without breaking native overlays.
      {
        id: "ui-scale",
        label: "حجم النص والواجهة",
        description: "تكبير القراءة وعناصر التحكم على الشاشات المختلفة.",
        kind: "select",
      },
      // TODO(settings-motion): Add an explicit preference while continuing to respect system reduced motion.
      {
        id: "motion",
        label: "تقليل الحركة داخل التطبيق",
        description: "تجاوز اختياري لتفضيل النظام؛ احترام تفضيل النظام قائم بالفعل.",
        kind: "toggle",
      },
      // TODO(settings-home-sections): Implement account-owned Home section ordering and visibility.
      {
        id: "home-sections",
        label: "تخصيص الصفحة الرئيسية",
        description: "ترتيب أقسام المكتبة وإظهارها أو إخفاؤها.",
        kind: "action",
      },
      // TODO(settings-spoilers): Define spoiler-safe title and episode-art presentation.
      {
        id: "spoilers",
        label: "إخفاء حرق الأحداث",
        description: "تغطية أوصاف وصور الحلقات غير المشاهدة عند تفعيل الخيار مستقبلًا.",
        kind: "toggle",
      },
      // TODO(settings-artwork-quality): Wire a bounded artwork-quality preference into native variant selection.
      {
        id: "artwork-quality",
        label: "جودة صور المكتبة",
        description: "الموازنة بين دقة الصور واستهلاك الشبكة.",
        kind: "select",
      },
    ],
  },
  {
    section: "playback",
    title: "إعدادات التشغيل الافتراضية",
    description: "تُنفّذ المشاهدة على جهازك. تظل أدوات المشغّل الحالية متاحة أثناء المشاهدة.",
    controls: [
      // TODO(settings-audio-language): Persist and apply ordered native-player audio language preferences.
      {
        id: "audio-language",
        label: "لغة الصوت المفضلة",
        description: "اختيار المسار المناسب عندما يقدم الملف أكثر من لغة.",
        kind: "select",
      },
      // TODO(settings-audio-fallback): Add an explicit secondary audio language preference.
      {
        id: "audio-fallback",
        label: "لغة الصوت البديلة",
        description: "اللغة التالية عند غياب المسار المفضل.",
        kind: "select",
      },
      // TODO(settings-autoplay): Implement cancellable next-episode playback for catalog identities.
      {
        id: "autoplay",
        label: "تشغيل الحلقة التالية تلقائيًا",
        description: "خاص بحلقات المكتبة، مع فرصة لإلغاء التشغيل التالي.",
        kind: "toggle",
      },
      // TODO(settings-resume): Implement an account/device default for resume prompts.
      {
        id: "resume",
        label: "عند استئناف المشاهدة",
        description: "الاستئناف مباشرة أو السؤال قبل المتابعة.",
        kind: "select",
      },
      // TODO(settings-source-resume): Preserve playback position when changing compatible sources.
      {
        id: "source-resume",
        label: "الاحتفاظ بالموضع عند تغيير المصدر",
        description: "متابعة المشهد نفسه عند اختيار مصدر آخر متوافق.",
        kind: "toggle",
      },
      // TODO(settings-start-fullscreen): Persist a native player fullscreen-start default.
      {
        id: "start-fullscreen",
        label: "بدء المشغّل بملء الشاشة",
        description: "تطبيق الخيار عند فتح فيديو جديد.",
        kind: "toggle",
      },
      // TODO(settings-seek-step): Apply configurable seek steps to native transport and shortcuts.
      {
        id: "seek-step",
        label: "مدة التقديم والتأخير",
        description: "عدد الثواني لكل ضغطة في أدوات التنقل.",
        kind: "number",
      },
      // TODO(settings-default-speed): Persist a validated default playback speed.
      {
        id: "default-speed",
        label: "سرعة التشغيل الافتراضية",
        description: "تُطبّق على المقاطع الجديدة، ويمكن تغييرها أثناء المشاهدة.",
        kind: "select",
      },
      // TODO(settings-shortcuts): Add conflict-aware shortcut editing and native key mapping.
      {
        id: "shortcuts",
        label: "اختصارات لوحة المفاتيح",
        description: "عرض الاختصارات وتخصيصها دون تعارض.",
        kind: "action",
      },
    ],
  },
  {
    section: "playback",
    title: "الفيديو والأداء — مستقبلًا",
    description: "خيارات متقدمة تحتاج اختبار المشغّل والعتاد؛ لا تُفعّل أي معالجة في هذه المعاينة.",
    controls: [
      // TODO(settings-hardware-decode): Expose tested native decoder capabilities and fallback diagnostics.
      {
        id: "hardware-decode",
        label: "فك الترميز باستخدام العتاد",
        description: "اختيار آمن يعتمد على دعم الجهاز والمشغّل.",
        kind: "select",
      },
      // TODO(settings-video-fit): Persist aspect-ratio/fit defaults with native player support.
      {
        id: "video-fit",
        label: "ملاءمة الفيديو للشاشة",
        description: "الاحتفاظ بالأبعاد أو الملاءمة حسب إعداد المشغّل.",
        kind: "select",
      },
      // TODO(settings-anime4k): Integrate optional device-side shaders after GPU/power benchmarking.
      {
        id: "anime4k",
        label: "تحسين الصورة باستخدام Anime4K",
        description: "مستقبلي واختياري؛ يعمل على جهاز المشاهدة ويتطلب اختبار التوافق.",
        kind: "toggle",
      },
      // TODO(settings-anime4k-quality): Gate quality presets on measured frame time and power usage.
      {
        id: "anime4k-quality",
        label: "جودة تحسين الصورة",
        description: "مستويات تعتمد على قدرة الجهاز، دون وعد بدعم الهواتف قبل الاختبار.",
        kind: "select",
      },
      // TODO(settings-player-diagnostics): Present safe frame/drop/decoder metrics from the player adapter.
      {
        id: "player-diagnostics",
        label: "معلومات أداء المشغّل",
        description: "عرض الإطارات المتأخرة وطريقة فك الترميز أثناء الاختبار.",
        kind: "toggle",
      },
    ],
  },
  {
    section: "subtitles",
    title: "اللغات واختيار الترجمة",
    description:
      "تفضيلات افتراضية مستقبلية؛ إضافة ملف ترجمة وتعديل التوقيت متاحان حاليًا داخل المشغّل.",
    controls: [
      // TODO(settings-subtitle-language): Persist Arabic-first ordered subtitle language preferences.
      {
        id: "subtitle-language",
        label: "لغة الترجمة المفضلة",
        description: "العربية أولًا مع إمكانية اختيار لغة أخرى.",
        kind: "select",
      },
      // TODO(settings-subtitle-fallback): Apply secondary subtitle language matching.
      {
        id: "subtitle-fallback",
        label: "لغة الترجمة البديلة",
        description: "تُستخدم إذا لم تتوفر الترجمة المفضلة.",
        kind: "select",
      },
      // TODO(settings-subtitle-default): Persist embedded/local subtitle selection rules.
      {
        id: "subtitle-default",
        label: "اختيار الترجمة افتراضيًا",
        description: "قواعد اختيار المسارات المضمّنة والملفات المحلية.",
        kind: "select",
      },
      // TODO(settings-subtitle-forced): Add explicit forced-track preference and evidence labels.
      {
        id: "subtitle-forced",
        label: "تفضيل الترجمة الإجبارية",
        description: "عندما يحدد المصدر أن المسار مخصص للمقاطع الأجنبية.",
        kind: "toggle",
      },
      // TODO(settings-subtitle-sdh): Expose hearing-impaired subtitle preferences with provider evidence.
      {
        id: "subtitle-sdh",
        label: "ترجمة ضعاف السمع",
        description: "تفضيل المسارات التي تتضمن وصف الأصوات.",
        kind: "toggle",
      },
      // TODO(settings-subtitle-offset): Store per-file offsets without applying them to unrelated releases.
      {
        id: "subtitle-offset",
        label: "تذكّر الترجمة والتوقيت لكل ملف",
        description: "حفظ اختيارك وتصحيح التوقيت للملف نفسه فقط.",
        kind: "toggle",
      },
    ],
  },
  {
    section: "subtitles",
    title: "المظهر الافتراضي للترجمة",
    description: "ستُستخدم هذه القيم عند فتح المشغّل؛ أدوات الجلسة الحالية لا تتغير.",
    controls: [
      // TODO(settings-subtitle-font): Persist available fonts and test Arabic/ASS rendering.
      {
        id: "subtitle-font",
        label: "خط الترجمة",
        description: "خط يدعم العربية مع مراعاة تنسيق ASS الأصلي.",
        kind: "select",
      },
      // TODO(settings-subtitle-size): Persist validated default subtitle sizing.
      {
        id: "subtitle-size",
        label: "حجم خط الترجمة",
        description: "حجم افتراضي قابل للتعديل أثناء المشاهدة.",
        kind: "number",
      },
      // TODO(settings-subtitle-outline): Persist outline/background appearance through the player adapter.
      {
        id: "subtitle-outline",
        label: "حدود وخلفية الترجمة",
        description: "تحسين قابلية القراءة فوق المشاهد الفاتحة والداكنة.",
        kind: "select",
      },
      // TODO(settings-subtitle-position): Persist a bounded subtitle position default.
      {
        id: "subtitle-position",
        label: "موضع الترجمة",
        description: "المسافة عن الحافة السفلية للفيديو.",
        kind: "number",
      },
      // TODO(settings-subtitle-encoding): Add an explicit import-encoding override and Arabic fixtures.
      {
        id: "subtitle-encoding",
        label: "ترميز الملفات المستوردة",
        description: "معالجة ملفات الترجمة القديمة التي لا تستخدم UTF-8.",
        kind: "select",
      },
    ],
  },
  {
    section: "subtitles",
    title: "OpenSubtitles",
    description:
      "اتصال شخصي على هذا الجهاز. البحث والتنزيل صريحان؛ فتح العمل لن ينزّل ترجمة تلقائيًا.",
    controls: [
      // TODO(settings-opensubtitles-login): Add native REST authentication with registered application credentials and local secret storage.
      {
        id: "opensubtitles-login",
        label: "ربط حساب OpenSubtitles",
        description: "تسجيل الدخول الشخصي مع احترام شروط المزود وحصته.",
        kind: "action",
      },
      // TODO(settings-opensubtitles-test): Add a bounded connection/expiry/quota check without downloading subtitles.
      {
        id: "opensubtitles-test",
        label: "اختبار الاتصال وحصة التنزيل",
        description: "عرض حالة الحساب وحدود الخدمة دون بدء تنزيل.",
        kind: "action",
      },
      // TODO(settings-subtitle-release-match): Implement release/hash/language evidence and manual result review.
      {
        id: "subtitle-release-match",
        label: "مطابقة الإصدار والملف",
        description: "استخدام هوية الحلقة والإصدار والأدلة المتاحة عند ترتيب النتائج.",
        kind: "toggle",
      },
      // TODO(settings-subtitle-save): Attach explicitly downloaded subtitles to device-owned videos.
      {
        id: "subtitle-save",
        label: "حفظ الترجمة مع فيديو الجهاز",
        description: "الاحتفاظ بالترجمة التي تختار تنزيلها بجانب الفيديو.",
        kind: "toggle",
      },
      // TODO(settings-subtitle-providers): Add other subtitle providers only through the same capability boundary.
      {
        id: "subtitle-providers",
        label: "مزودو ترجمة إضافيون",
        description: "مستقبلي: اتصالات مستقلة مع حالة دعم واضحة لكل مزود.",
        kind: "action",
      },
    ],
  },
  {
    section: "sources",
    title: "تفضيلات اختيار المصدر",
    description: "مصادر الفيديو تستخدم واجهة نحّاسيو؛ التوفر واللغة لا يُعدّان مؤكدين دون دليل.",
    controls: [
      // TODO(settings-source-order): Persist per-account/device provider enablement and ordering.
      {
        id: "source-order",
        label: "ترتيب المصادر وإدارتها",
        description: "ترتيب المزودين وإيقاف المصادر التي لا تريد استخدامها.",
        kind: "action",
      },
      // TODO(settings-source-quality): Apply normalized quality filters in the source picker.
      {
        id: "source-quality",
        label: "الجودة المفضلة",
        description: "ترتيب النتائج بحسب الدقة المتاحة.",
        kind: "select",
      },
      // TODO(settings-source-size): Add a validated maximum result size filter.
      {
        id: "source-size",
        label: "الحد المفضل لحجم الملف",
        description: "تصفية النتائج الكبيرة دون الادعاء بأن الحجم معروف دائمًا.",
        kind: "number",
      },
      // TODO(settings-source-codec): Apply codec preferences only when a source declares reliable metadata.
      {
        id: "source-codec",
        label: "ترميز الفيديو المفضل",
        description: "ترتيب الترميزات المتوافقة مع جهازك عندما تكون معلوماتها متاحة.",
        kind: "select",
      },
      // TODO(settings-source-language): Filter language evidence separately from inferred language.
      {
        id: "source-language",
        label: "تفضيلات لغة المصادر",
        description: "عرض دليل لغة الصوت والترجمة وتمييز المعلومات المستنتجة.",
        kind: "select",
      },
      // TODO(settings-release-groups): Implement release-group preferences without raw source URL persistence.
      {
        id: "release-groups",
        label: "مجموعات الإصدار المفضلة",
        description: "ترتيب الإصدارات المعروفة لديك ضمن النتائج.",
        kind: "text",
      },
      // TODO(settings-embed-mode): Add explicit hosted-player preferences with capability warnings.
      {
        id: "embed-mode",
        label: "السماح بالمشغّلات المستضافة",
        description: "بعض المصادر تستخدم مشغّلها الخاص ولا تدعم أدوات نحّاسيو الكاملة.",
        kind: "toggle",
      },
      // TODO(settings-external-search): Implement title/episode search without creating tracking history.
      {
        id: "external-search",
        label: "البحث خارج المكتبة",
        description: "بحث ثانوي بلا سجل مشاهدة أو تقدم؛ اقتراح الأعمال يمر بمراجعة الإدارة.",
        kind: "action",
      },
    ],
  },
  {
    section: "sources",
    title: "اتصالات Debrid الشخصية",
    description:
      "بيانات الحساب سرية ومحلية لكل خادم وحساب. الطلبات والفيديو تأتي من جهاز المشاهدة.",
    controls: [
      // TODO(settings-real-debrid): Implement Real-Debrid device authorization and guarded direct playback.
      {
        id: "real-debrid",
        label: "ربط Real-Debrid",
        description: "تفويض الجهاز، عرض انتهاء الاتصال وإمكانية إلغائه.",
        kind: "action",
      },
      // TODO(settings-debrid-test): Bound connection checks and prohibit paid/download operations during tests.
      {
        id: "debrid-test",
        label: "اختبار اتصال Debrid",
        description: "فحص حالة الحساب فقط دون بدء عملية تنزيل أو عملية مدفوعة.",
        kind: "action",
      },
      // TODO(settings-debrid-order): Implement capability-aware preference between compatible direct/debrid/torrent offers.
      {
        id: "debrid-order",
        label: "تفضيل الروابط المباشرة",
        description: "ترتيب النتائج المتوافقة دون إخفاء سبب تعذر أي مصدر.",
        kind: "toggle",
      },
      // TODO(settings-other-debrid): Add additional services after the first provider passes acceptance.
      {
        id: "other-debrid",
        label: "خدمات Debrid أخرى",
        description: "مستقبلي: مزودون إضافيون عبر واجهة الاتصال نفسها.",
        kind: "action",
      },
    ],
  },
  {
    section: "extensions",
    title: "إضافات Stremio",
    description: "الصق الرابط، راجع الإمكانات والخصوصية، ثم ثبّت الإضافة. لا يتطلب ذلك حساب Stremio.",
    controls: [
      // TODO(settings-addon-manifest): Normalize stremio:// to HTTPS and validate bounded manifests/redirects natively.
      {
        id: "addon-manifest",
        label: "رابط manifest.json أو stremio://",
        description: "رابط HTTPS عام؛ تبقى الأسرار المضمّنة في الإعدادات داخل التخزين الأصلي الآمن.",
        kind: "text",
      },
      // TODO(settings-addon-review): Show supported stream/subtitle resources and unsupported capabilities before installation.
      {
        id: "addon-review",
        label: "مراجعة الإضافة وتثبيتها",
        description: "عرض المزود والموارد والطلبات والقيود قبل الموافقة على التثبيت.",
        kind: "action",
      },
      // TODO(settings-addon-installed): Implement native scoped installation, ordering, configuration and removal.
      {
        id: "addon-installed",
        label: "إدارة الإضافات المثبّتة",
        description: "الإعداد والترتيب والإزالة بشكل مستقل لكل حساب وخادم.",
        kind: "action",
      },
      // TODO(settings-addon-updates): Implement explicit manifest change review rather than silent capability expansion.
      {
        id: "addon-updates",
        label: "مراجعة تحديثات الإضافات",
        description: "التحديثات صريحة، مع مراجعة تغيّر الإمكانات.",
        kind: "action",
      },
      // TODO(settings-addon-private-network): Reject private-network targets by default and design explicit narrowly scoped exceptions.
      {
        id: "addon-private-network",
        label: "استثناءات الشبكة المحلية",
        description: "الوصول إلى العناوين الخاصة مرفوض افتراضيًا؛ الاستثناءات تحتاج مراجعة منفصلة.",
        kind: "action",
      },
    ],
  },
  {
    section: "extensions",
    title: "صيغ إضافات أخرى — بحث مستقبلي",
    description:
      "هذه الصيغ ليست ملفات Stremio ولا تعني المعاينة أنها مدعومة. توافقها التنفيذي مؤجّل.",
    controls: [
      // TODO(settings-kai-import): Evaluate .kai architecture and isolation before deciding whether to implement a runtime.
      {
        id: "kai-import",
        label: "استيراد ملف .kai",
        description: "غير مدعوم؛ يحتاج قرارًا مستقلًا بشأن التنفيذ والعزل.",
        kind: "action",
      },
      // TODO(settings-seanime-import): Evaluate Seanime JSON/runtime semantics independently of Stremio manifests.
      {
        id: "seanime-import",
        label: "استيراد Seanime JSON",
        description: "غير مدعوم؛ ملف JSON وحده لا يوفر محرك توافق.",
        kind: "action",
      },
    ],
  },
  {
    section: "storage",
    title: "مواقع الملفات وحدود التنزيل",
    description: "خيارات مستقبلية للجهاز؛ لا تغيّر مكان الملفات الموجودة أو تنقلها تلقائيًا.",
    controls: [
      // TODO(settings-download-folder): Use a native directory chooser/portal and preserve registered existing paths.
      {
        id: "download-folder",
        label: "اختيار مجلد التنزيل",
        description: "تحديد مكان التنزيلات الجديدة فقط مع فحص قابلية الكتابة.",
        kind: "action",
      },
      // TODO(settings-parallel-downloads): Implement a durable transfer concurrency preference.
      {
        id: "parallel-downloads",
        label: "عدد التنزيلات المتزامنة",
        description: "تحديد عدد عمليات التنزيل النشطة على هذا الجهاز.",
        kind: "number",
      },
      // TODO(settings-download-rate): Apply native transfer download rate limits with explicit units.
      {
        id: "download-rate",
        label: "حد سرعة التنزيل",
        description: "تحديد حد واضح للسرعة مع خيار دون حد.",
        kind: "number",
      },
      // TODO(settings-upload-rate): Apply upload limits to the device torrent engine.
      {
        id: "upload-rate",
        label: "حد سرعة الرفع",
        description: "خاص بتورنتات الجهاز، ولا يغيّر إعدادات الخادم.",
        kind: "number",
      },
      // TODO(settings-disk-reservation): Enforce space reservation before transfer admission and recovery.
      {
        id: "disk-reservation",
        label: "المساحة الحرة الاحتياطية",
        description: "إيقاف بدء تنزيلات جديدة إذا انخفضت المساحة عن الحد.",
        kind: "number",
      },
      // TODO(settings-metered-downloads): Integrate device network cost detection and pause/resume semantics.
      {
        id: "metered-downloads",
        label: "إيقاف التنزيل على اتصال محدود",
        description: "عندما يستطيع النظام تحديد أن الاتصال محسوب التكلفة.",
        kind: "toggle",
      },
      // TODO(settings-download-companions): Save authorized artwork/metadata/selected subtitles alongside device video.
      {
        id: "download-companions",
        label: "حفظ الصور والبيانات والترجمة مع الفيديو",
        description: "حزمة مستقلة للمشاهدة دون اتصال وفق صلاحيات الحساب.",
        kind: "toggle",
      },
      // TODO(settings-relink-files): Add a reviewed native relink workflow without moving original media.
      {
        id: "relink-files",
        label: "إعادة ربط الملفات المنقولة",
        description: "تحديد موقع جديد لملف محفوظ بدل تنزيله مجددًا.",
        kind: "action",
      },
      // TODO(settings-artwork-budget): Persist and enforce a bounded configurable LRU artwork cache budget.
      {
        id: "artwork-budget",
        label: "حد ذاكرة الصور المؤقتة",
        description: "الحد الحالي 512 ميغابايت؛ الصور المملوكة للمكتبة المحفوظة منفصلة.",
        kind: "number",
      },
    ],
  },
  {
    section: "offline",
    title: "المكتبة المحفوظة والمزامنة",
    description:
      "المحتوى محفوظ للخادم والحساب الأصليين. التعديلات دون اتصال تقتصر على التقدم وحالة المشاهدة.",
    controls: [
      // TODO(settings-offline-readiness): Expose per-work snapshot/artwork/file readiness without conflating Save work and video download.
      {
        id: "offline-readiness",
        label: "حالة الأعمال المحفوظة",
        description: "تمييز اكتمال البيانات والصور والفيديو لكل عمل.",
        kind: "action",
      },
      // TODO(settings-offline-refresh): Implement scoped authorized snapshot refresh and conflict-safe replacement.
      {
        id: "offline-refresh",
        label: "تحديث بيانات الأعمال المحفوظة",
        description: "مراجعة البيانات والصور عند الاتصال بالخادم مجددًا.",
        kind: "action",
      },
      // TODO(settings-sync-status): Expose pending tracking mutations and bounded manual sync diagnostics.
      {
        id: "sync-status",
        label: "حالة مزامنة المشاهدة",
        description: "عرض العمليات المنتظرة ونتائج المزامنة دون خلط الحسابات.",
        kind: "action",
      },
      // TODO(settings-sync-conflicts): Add reviewed conflict resolution without silently replacing newer progress.
      {
        id: "sync-conflicts",
        label: "مراجعة تعارضات المشاهدة",
        description: "الاختيار عند اختلاف التقدم المحفوظ على الجهاز والخادم.",
        kind: "action",
      },
      // TODO(settings-offline-source-refresh): Re-resolve durable saved source identities on the device without requiring catalog availability.
      {
        id: "offline-source-refresh",
        label: "تحديث مصادر الأعمال المحفوظة",
        description: "يحتاج الإنترنت للمزود، مع بقاء بيانات المكتبة متاحة دون الخادم.",
        kind: "action",
      },
    ],
  },
  {
    section: "connection",
    title: "فحص الاتصال",
    description: "تظل إدارة الخوادم الحالية متاحة أعلاه. هذه أدوات إضافية مخططة.",
    controls: [
      // TODO(settings-connection-diagnostics): Implement bounded staged reachability/TLS/API checks with redacted results.
      {
        id: "connection-diagnostics",
        label: "تشخيص الاتصال بالتفصيل",
        description: "تمييز مشكلة الشبكة والشهادة وإصدار واجهة الخادم.",
        kind: "action",
      },
      // TODO(settings-certificate-details): Display trusted certificate metadata without bypassing TLS validation.
      {
        id: "certificate-details",
        label: "تفاصيل شهادة الخادم",
        description: "عرض الصلاحية والثقة والتنبيه إلى مشكلات التجديد.",
        kind: "action",
      },
      // TODO(settings-reconnect-policy): Persist a bounded reconnect policy without bypassing account/session expiry.
      {
        id: "reconnect-policy",
        label: "إعادة الاتصال عند عودة الشبكة",
        description: "استعادة الاتصال مع احترام انتهاء الجلسة وحالة الحساب.",
        kind: "toggle",
      },
    ],
  },
  {
    section: "administration",
    title: "الوصول ومشاركة المكتبة",
    description:
      "إعدادات مشتركة يملكها مدير الخادم؛ نشر التطبيق للأصدقاء يحتاج checkpoint مستقلًا قبل الإتاحة.",
    controls: [
      // TODO(settings-friend-invites): Implement invitation issuance, expiry, activation and revocation before friend access.
      {
        id: "friend-invites",
        label: "دعوات الأصدقاء",
        description: "إنشاء دعوات محدودة الصلاحية وتفعيل الحسابات وإلغاء الدعوات.",
        kind: "action",
      },
      // TODO(settings-login-throttle): Implement and expose bounded server-side login throttling.
      {
        id: "login-throttle",
        label: "حدود محاولات تسجيل الدخول",
        description: "حماية تسجيل الدخول قبل إتاحة الخادم عبر الإنترنت.",
        kind: "number",
      },
      // TODO(settings-library-policies): Connect reviewed account content/download permissions to server-enforced policies.
      {
        id: "library-policies",
        label: "صلاحيات المكتبة والتنزيل",
        description: "تحديد الوصول للمحتوى والتنزيل والإدارة لكل حساب.",
        kind: "action",
      },
      // TODO(settings-family-policies): Decide and implement optional family/child policies separately from account identity.
      {
        id: "family-policies",
        label: "قيود العائلة والأطفال",
        description: "مستقبلي: يحتاج تحديد السياسة ومراجعة تطبيقها على الخادم.",
        kind: "action",
      },
      // TODO(settings-https-readiness): Add a deployment readiness report for trusted HTTPS and automated certificate renewal.
      {
        id: "https-readiness",
        label: "جاهزية الوصول عبر الإنترنت",
        description: "فحص HTTPS الموثوق والتجديد والاسترداد دون تغيير الشبكة من هذه الصفحة.",
        kind: "action",
      },
    ],
  },
  {
    section: "administration",
    title: "الوسائط والعمليات — مراحل لاحقة",
    description: "تبقى إدارة البيانات المتاحة في لوحة الإدارة. الخيارات التالية لم تُنفّذ بعد.",
    controls: [
      // TODO(settings-jellyfin): Implement optional delivery-only matching; never synchronize metadata or viewing history from Jellyfin.
      {
        id: "jellyfin",
        label: "ربط Jellyfin",
        description: "مصدر ملفات اختياري؛ تبقى البيانات والصور والتتبع مملوكة لنحّاسيو.",
        kind: "action",
      },
      // TODO(settings-server-roots): Add reviewed server media/staging root configuration without implicit moves.
      {
        id: "server-roots",
        label: "مواقع مكتبة الخادم والتجهيز",
        description: "إدارة المواقع وفحص الصلاحيات مع الحفاظ على الملفات الأصلية.",
        kind: "action",
      },
      // TODO(settings-library-scan): Add explicit scan/import/matching previews and file verification.
      {
        id: "library-scan",
        label: "فحص الملفات ومطابقتها",
        description: "استيراد الملفات الموجودة وربطها بالأعمال والحلقات بعد المراجعة.",
        kind: "action",
      },
      // TODO(settings-server-jobs): Implement explicit server acquisition defaults independently of device torrents.
      {
        id: "server-jobs",
        label: "افتراضيات تنزيلات الخادم",
        description: "طابور مستقل لا يبدأ إلا بطلب تنزيل صريح إلى الخادم.",
        kind: "action",
      },
      // TODO(settings-server-subtitles): Define explicit server subtitle jobs and storage ownership before enabling.
      {
        id: "server-subtitles",
        label: "ترجمات ملفات الخادم",
        description: "بحث وحفظ صريح للترجمة مع وسائط الخادم؛ منفصل عن الحسابات الشخصية.",
        kind: "action",
      },
      // TODO(settings-scheduled-updates): Add scheduled server updates only after backup/readiness/rollback acceptance.
      {
        id: "scheduled-updates",
        label: "جدولة تحديثات الخادم",
        description: "مستقبلي: بعد التحقق من النسخ الاحتياطية والتوافق والاسترداد.",
        kind: "action",
      },
      // TODO(settings-suggestions): Implement deduplicated suggestion records and an authorized admin review queue.
      {
        id: "suggestions",
        label: "طلبات اقتراح الأعمال",
        description: "مراجعة اقتراحات المستخدمين قبل إضافة عمل إلى المكتبة.",
        kind: "action",
      },
    ],
  },
  {
    section: "help",
    title: "أدوات الدعم",
    description: "لا تُرسل أي معلومات تلقائيًا؛ تبقى المعاينة والمراجعة جزءًا من مشاركة التشخيص.",
    controls: [
      // TODO(settings-diagnostic-file): Add a user-triggered native save dialog for the existing allowlisted diagnostic report.
      {
        id: "diagnostic-file",
        label: "حفظ تقرير التشخيص كملف",
        description: "معاينة التقرير المنقّح قبل تصديره أو مشاركته.",
        kind: "action",
      },
      // TODO(settings-source-diagnostics): Implement redacted per-provider failure reports without configured token URLs.
      {
        id: "source-diagnostics",
        label: "تشخيص المصادر والإضافات",
        description: "عرض سبب الفشل مع حجب المفاتيح والروابط السرية.",
        kind: "action",
      },
      // TODO(settings-shortcut-guide): Provide an accessible searchable guide reflecting actual native shortcuts.
      {
        id: "shortcut-guide",
        label: "دليل الاختصارات",
        description: "شرح اختصارات التنقل والتشغيل المتاحة فعلًا.",
        kind: "action",
      },
    ],
  },
  {
    section: "help",
    title: "المنصات المستقبلية",
    description:
      "ليست تطبيقات متاحة الآن. لكل منصة مرحلة تحقق منفصلة، ولا يمر الفيديو عبر خادم العائلة لتحقيق التكافؤ.",
    controls: [
      // TODO(settings-browser-client): Deliver authenticated catalog/admin first, then capability-limited compatible playback.
      {
        id: "browser-client",
        label: "عميل المتصفح",
        description: "المكتبة والتتبع والإدارة أولًا؛ التشغيل حسب دعم المتصفح والمزود.",
        kind: "action",
      },
      // TODO(settings-android-client): Complete Android lifecycle/storage/Media3 player feasibility before platform delivery.
      {
        id: "android-client",
        label: "تطبيق Android",
        description: "مستقبلي: يحتاج تحققًا من المشغّل والتخزين ودورة حياة التطبيق.",
        kind: "action",
      },
      // TODO(settings-other-clients): Evaluate Android TV/Windows/macOS after the agreed platform milestones.
      {
        id: "other-clients",
        label: "Android TV وWindows وmacOS",
        description: "منصات أبعد في خارطة الطريق؛ لا توجد حزمة قابلة للتثبيت هنا.",
        kind: "action",
      },
    ],
  },
];

function UpcomingControl({ control }: { control: PlannedControl }) {
  const id = `upcoming-${control.id}`;
  const describedBy = `${id}-description`;
  return (
    <SettingsRow
      id={id}
      label={control.label}
      description={control.description}
      compact={control.kind === "toggle"}
      disabled
    >
      {control.kind === "toggle" ? (
        <Switch id={id} disabled checked={false} aria-describedby={describedBy} />
      ) : control.kind === "select" ? (
        <Select disabled value={null}>
          <SelectTrigger id={id} aria-describedby={describedBy} className="w-full">
            <SelectValue placeholder="متاح لاحقًا" />
          </SelectTrigger>
        </Select>
      ) : control.kind === "action" ? (
        <Button id={id} disabled variant="outline" aria-describedby={describedBy}>
          {control.label}
        </Button>
      ) : (
        <Input
          id={id}
          disabled
          type={control.kind === "number" ? "number" : "text"}
          placeholder="متاح لاحقًا"
          aria-describedby={describedBy}
        />
      )}
    </SettingsRow>
  );
}

export function UpcomingSettings({ section }: { section: Section }) {
  return plannedGroups
    .filter((group) => group.section === section)
    .map((group) => (
      <SettingsPanel key={group.title} title={group.title} description={group.description}>
        <FieldGroup className="gap-0 divide-y">
          {group.controls.map((control) => (
            <UpcomingControl key={control.id} control={control} />
          ))}
        </FieldGroup>
      </SettingsPanel>
    ));
}
