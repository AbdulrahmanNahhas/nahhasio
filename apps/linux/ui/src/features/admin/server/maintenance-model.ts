const states = {
  queued: "في الانتظار",
  running: "قيد التنفيذ",
  succeeded: "اكتملت",
  failed: "تعذّرت العملية",
  current: "محدّث",
  available: "تحديث متاح",
  staged: "جاهز لإعادة التشغيل",
  unchecked: "لم يُفحص بعد",
  "maintenance-required": "يتطلب صيانة",
  unavailable: "غير متاح",
  unmanaged: "نسخة تطوير",
  "up-to-date": "محدّث",
};
export const stateLabel = (value: string) =>
  Object.entries(states).find(([key]) => key === value)?.[1] ?? value;
const operations = {
  backup: "إنشاء نسخة احتياطية",
  restore: "استعادة نسخة",
  "check-update": "فحص التحديثات",
  update: "تحديث الخادم",
};
export const operationLabel = (value: string) =>
  Object.entries(operations).find(([key]) => key === value)?.[1] ?? "عملية صيانة";
