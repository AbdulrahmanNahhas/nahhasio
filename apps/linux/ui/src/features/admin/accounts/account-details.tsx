import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";

import { Choice } from "@/components/choice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import {
  accountKinds,
  accountStatuses,
  activityChoices,
  capabilityChoices,
  capabilitySchema,
  dateLabel,
  identityOptions,
  policySchema,
  preferenceSchema,
  recordOptions,
  roleLabel,
  sessionSchema,
  type ManagedAccount,
} from "./accounts-data";
import { AccountPanel, Facts, NoRecords, ReadFailure, RecordsPager } from "./accounts-primitives";

function SessionIdentity({ userId }: { userId: string }) {
  const identity = useQuery(identityOptions(userId));
  return (
    <span>
      {identity.isPending
        ? "جارٍ قراءة الحساب…"
        : identity.error
          ? "تعذّر قراءة اسم الحساب"
          : (identity.data?.name ?? "حساب غير متاح")}
    </span>
  );
}
export function SessionsPanel({
  field,
  value,
  name,
}: {
  field: "user_id" | "device_id";
  value: string;
  name?: string;
}) {
  const [page, setPage] = useState(1);
  const sessions = useQuery(recordOptions("auth_sessions", page, value, field));
  const rows =
    sessions.data?.rows
      .map((row) => sessionSchema.parse(row))
      .filter((row) => row[field] === value) ?? [];
  return (
    <AccountPanel
      title="الجلسات المسجّلة"
      description="الجلسة غير المنتهية لا تعني أن الجهاز متصل الآن. قد يمنع الوصولَ إيقاف الحساب أو إلغاء الجهاز."
    >
      <div className="flex flex-col gap-3">
        {sessions.isPending && <Skeleton className="h-24" />}
        {sessions.error && (
          <ReadFailure error={sessions.error} retry={() => void sessions.refetch()} />
        )}
        {sessions.data && rows.length === 0 && (
          <NoRecords
            title="لا توجد جلسات في هذه الصفحة"
            description="قد لا يكون الحساب قد سجّل الدخول بعد، أو أُزيلت جلساته السابقة."
          />
        )}
        {rows.map((row) => (
          <Item key={row.id} variant="outline" size="sm">
            <ItemContent>
              <ItemTitle>{name ?? <SessionIdentity userId={row.user_id} />}</ItemTitle>
              <ItemDescription>
                {row.device_id ? "جهاز مسجّل" : "جلسة دون جهاز مرتبط"}
              </ItemDescription>
              <p className="text-xs text-muted-foreground">
                بدأت {dateLabel(row.created_at)} · تنتهي {dateLabel(row.expires_at)}
              </p>
            </ItemContent>
            <Badge variant="outline">
              {new Date(row.expires_at).getTime() <= sessions.dataUpdatedAt
                ? "منتهية"
                : "لم تنتهِ بعد"}
            </Badge>
            {/* TODO(admin-session-revoke): Connect server-authorized revocation with a named-session confirmation and audit record. */}
            <Button variant="outline" size="sm" disabled>
              إلغاء الجلسة
            </Button>
          </Item>
        ))}
        {sessions.data && (
          <RecordsPager
            page={page}
            total={sessions.data.total}
            pageSize={sessions.data.pageSize}
            pending={sessions.isFetching}
            onChange={setPage}
          />
        )}
      </div>
    </AccountPanel>
  );
}

export function AccountIdentity({ account }: { account: ManagedAccount }) {
  const identity = useQuery(identityOptions(account.auth_user_id));
  return (
    <AccountPanel
      title="بيانات الحساب"
      description="حساب الدخول وملف المكتبة مرتبطان، ولكل منهما حالة مستقلة."
    >
      <Facts
        entries={[
          ["الاسم الظاهر", account.display_name],
          ["نوع الحساب", accountKinds[account.kind]],
          ["حالة المكتبة", accountStatuses[account.status]],
          ["آخر نشاط مسجّل", dateLabel(account.last_seen_at)],
          ["تاريخ الإنشاء", dateLabel(account.created_at)],
          ["ظهور الملف للآخرين", account.is_discoverable ? "ظاهر" : "مخفي"],
        ]}
      />
      {!account.auth_user_id ? (
        <p className="text-sm text-muted-foreground">لم يُربط الحساب ببيانات تسجيل الدخول بعد.</p>
      ) : identity.isPending ? (
        <Skeleton className="h-24" />
      ) : identity.error ? (
        <ReadFailure error={identity.error} retry={() => void identity.refetch()} />
      ) : identity.data ? (
        <Facts
          entries={[
            [
              "البريد الإلكتروني",
              <bdi key="email" className="break-all">
                {identity.data.email}
              </bdi>,
            ],
            ["دور الدخول", roleLabel(identity.data.role)],
            ["التحقق من البريد", identity.data.email_verified ? "مؤكّد" : "غير مؤكّد"],
            [
              "حظر الدخول",
              identity.data.banned
                ? identity.data.ban_expires
                  ? `مسجّل حتى ${dateLabel(identity.data.ban_expires)}`
                  : "حظر مسجّل دون موعد انتهاء"
                : "لا يوجد حظر مسجّل",
            ],
          ]}
        />
      ) : (
        <p className="text-sm text-muted-foreground">تعذّر العثور على هوية الدخول المرتبطة.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {/* TODO(admin-account-edit): Add guarded profile/email editing, stale-record checks and review before saving. */}
        <Button size="sm" variant="outline" disabled>
          تعديل بيانات الحساب
        </Button>
        {/* TODO(admin-account-suspend): Implement account disabling/reactivation with owner/self-protection and session revocation. */}
        <Button size="sm" variant="outline" disabled>
          {account.status === "suspended" ? "إعادة تفعيل الحساب" : "إيقاف الحساب"}
        </Button>
        {/* TODO(admin-password-reset): Implement explicit account recovery/reset without exposing stored credentials. */}
        <Button size="sm" variant="ghost" disabled>
          إعادة تعيين كلمة المرور
        </Button>
      </div>
    </AccountPanel>
  );
}

const risk = (value: string) =>
  ({ none: "لا يوجد", low: "منخفض", medium: "متوسط", high: "مرتفع" })[
    z.enum(["none", "low", "medium", "high"]).parse(value)
  ];

export function AccessPanel({ account }: { account: ManagedAccount }) {
  const capabilities = useQuery(recordOptions("account_capabilities", 1, account.id, "account_id"));
  const policy = useQuery(recordOptions("account_content_policies", 1, account.id, "account_id"));
  const restrictions = useQuery(
    recordOptions("account_admin_restrictions", 1, account.id, "account_id"),
  );
  const granted =
    capabilities.data?.rows
      .map((row) => capabilitySchema.parse(row))
      .filter((row) => row.account_id === account.id)
      .map((row) => row.capability) ?? [];
  const current = policy.data?.rows
    .map((row) => policySchema.parse(row))
    .find((row) => row.account_id === account.id);
  const adminPolicy = restrictions.data?.rows
    .map((row) => policySchema.parse(row))
    .find((row) => row.account_id === account.id);

  return (
    <>
      <AccountPanel
        title="الصلاحيات المضافة"
        description="تعرض المنح المسجّلة للحساب. قد يمنح دور الدخول صلاحيات أخرى؛ الخادم هو الذي يقرر الوصول الفعلي."
      >
        {capabilities.error && (
          <ReadFailure error={capabilities.error} retry={() => void capabilities.refetch()} />
        )}
        {capabilities.isPending ? (
          <Skeleton className="h-32" />
        ) : capabilities.error ? null : (
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            {capabilityChoices.map((choice) => (
              <Field
                key={choice.value}
                orientation="horizontal"
                data-disabled
                className="justify-between"
              >
                <FieldLabel htmlFor={`capability-${choice.value}`}>{choice.label}</FieldLabel>
                {/* TODO(admin-capabilities): Enable grant/revoke only through an audited permission mutation with owner protections. */}
                <Switch
                  id={`capability-${choice.value}`}
                  checked={granted.includes(choice.value)}
                  disabled
                />
              </Field>
            ))}
          </FieldGroup>
        )}
      </AccountPanel>
      <AccountPanel
        title="حدود المحتوى"
        description="الحدود المسجّلة لعرض المكتبة؛ تعديلها غير متاح بعد."
      >
        {policy.isPending ? (
          <Skeleton className="h-24" />
        ) : policy.error ? (
          <ReadFailure error={policy.error} retry={() => void policy.refetch()} />
        ) : current ? (
          <Facts
            entries={[
              [
                "الجمهور",
                current.audience === "general"
                  ? "عام"
                  : current.audience === "teen"
                    ? "يافعون"
                    : current.audience === "young-adult"
                      ? "شباب"
                      : "بالغون",
              ],
              [
                "الفئة العمرية",
                current.age === "all" ? "جميع الأعمار" : <bdi key="age">{current.age}</bdi>,
              ],
              ["المحتوى الجنسي", risk(current.sexuality_risk)],
              ["المحتوى السلوكي", risk(current.behavioral_risk)],
              ["المحتوى العقدي", risk(current.theology_risk)],
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            لا توجد سياسة محتوى مخصّصة مسجّلة. لا يعني ذلك وصولًا غير محدود.
          </p>
        )}
        {restrictions.error && (
          <ReadFailure error={restrictions.error} retry={() => void restrictions.refetch()} />
        )}
        {adminPolicy && (
          <p className="mt-3 text-sm text-muted-foreground">
            يوجد نطاق تحريري مخصّص لهذا الحساب: عمر {adminPolicy.age}، محتوى جنسي{" "}
            {risk(adminPolicy.sexuality_risk)}، سلوكي {risk(adminPolicy.behavioral_risk)}، عقدي{" "}
            {risk(adminPolicy.theology_risk)}.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {/* TODO(admin-content-policy): Add reviewed content/editorial limit mutations and conflict-safe policy changes. */}
          <Button variant="outline" size="sm" disabled>
            تعديل حدود المحتوى
          </Button>
          {/* TODO(admin-content-exceptions): Build named title/tag/genre/entity/planet exception editors with exact account scoping. */}
          <Button variant="outline" size="sm" disabled>
            إدارة استثناءات الوصول
          </Button>
        </div>
      </AccountPanel>
    </>
  );
}

export function PreferencesPanel({ accountId }: { accountId: string }) {
  const query = useQuery(recordOptions("account_preferences", 1, accountId, "account_id"));
  const preferences = query.data?.rows
    .map((row) => preferenceSchema.parse(row))
    .find((row) => row.account_id === accountId);
  return (
    <AccountPanel
      title="تفضيلات المشاهدة المسجّلة"
      description="تفضيلات الحساب الموجودة على الخادم؛ تختلف عن تفضيلات جهاز Linux المحلي."
    >
      {query.isPending ? (
        <Skeleton className="h-24" />
      ) : query.error ? (
        <ReadFailure error={query.error} retry={() => void query.refetch()} />
      ) : preferences ? (
        <Facts
          entries={[
            ["لغة الواجهة", preferences.locale],
            ["المظهر", preferences.theme],
            ["لغات الصوت", preferences.preferred_audio.join("، ") || "غير محددة"],
            ["لغات الترجمة", preferences.preferred_subtitles.join("، ") || "غير محددة"],
            ["التشغيل التلقائي", preferences.autoplay ? "مفعّل" : "متوقف"],
            ["إخفاء حرق الأحداث", preferences.hide_spoilers ? "مفعّل" : "متوقف"],
            ["تبديل المسارات", preferences.can_switch_tracks ? "مسموح" : "غير مسموح"],
            ["إشعارات الردود", preferences.notify_replies ? "مفعّلة" : "متوقفة"],
          ]}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          لا توجد تفضيلات محفوظة على الخادم لهذا الحساب.
        </p>
      )}
      {/* TODO(admin-viewing-preferences): Add account-owned preference editing with defined precedence over device preferences. */}
      <Button className="mt-4" size="sm" variant="outline" disabled>
        تعديل تفضيلات المشاهدة
      </Button>
    </AccountPanel>
  );
}

const activitySchema = z.object({
  id: z.string().optional(),
  account_id: z.string().optional(),
  owner_account_id: z.string().optional(),
  name: z.string().optional(),
  message: z.string().optional(),
  body: z.string().optional(),
  title_id: z.string().nullish(),
  installment_id: z.string().nullish(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  viewed_at: z.string().optional(),
  position_seconds: z.number().optional(),
  is_played: z.boolean().optional(),
  is_favorite: z.boolean().optional(),
  personal_rating: z.number().nullable().optional(),
  visit_count: z.number().optional(),
});
const referenceSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  title_ar: z.string().nullable().optional(),
  canonical_title: z.string().optional(),
});
function ActivityName({ titleId, installmentId }: { titleId?: string; installmentId?: string }) {
  const query = useQuery({
    ...recordOptions(titleId ? "titles" : "installments", 1, titleId ?? installmentId ?? "", "id"),
    enabled: Boolean(titleId || installmentId),
  });
  const record = query.data?.rows
    .map((row) => referenceSchema.parse(row))
    .find((row) => row.id === (titleId ?? installmentId));
  return (
    <>
      {!titleId && !installmentId
        ? "سجل الحساب"
        : query.isPending
          ? "جارٍ قراءة اسم العمل…"
          : query.error
            ? "تعذّر قراءة اسم العمل"
            : record?.title_ar || record?.canonical_title || record?.title || "عمل غير متاح"}
    </>
  );
}
export function ViewingRecords({ accountId }: { accountId: string }) {
  const [table, setTable] = useState<string>(activityChoices[0].value);
  const [page, setPage] = useState(1);
  const query = useQuery(
    recordOptions(
      table,
      page,
      accountId,
      table === "collections" ? "owner_account_id" : "account_id",
    ),
  );
  const rows =
    query.data?.rows
      .map((row) => activitySchema.parse(row))
      .filter(
        (row) => (table === "collections" ? row.owner_account_id : row.account_id) === accountId,
      ) ?? [];
  return (
    <AccountPanel
      title="بيانات المشاهدة والتفاعل"
      description="اعرض نوعًا واحدًا من سجلات الحساب في كل مرة. لا تُعدّل هذه الصفحة التقدم أو التاريخ."
    >
      <div className="flex flex-col gap-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="viewing-records">نوع البيانات</FieldLabel>
            <Choice
              id="viewing-records"
              label="نوع البيانات"
              value={table}
              options={activityChoices}
              onChange={(value) => {
                const choice = activityChoices.find((item) => item.value === value);
                if (choice) {
                  setTable(choice.value);
                  setPage(1);
                }
              }}
            />
          </Field>
        </FieldGroup>
        {query.isPending && <Skeleton className="h-24" />}
        {query.error && <ReadFailure error={query.error} retry={() => void query.refetch()} />}
        {query.data && rows.length === 0 && (
          <NoRecords
            title="لا توجد سجلات لهذا النوع في هذه الصفحة"
            description="اختر نوعًا آخر من بيانات الحساب، أو انتقل إلى صفحة النتائج التالية إن وُجدت."
          />
        )}
        {rows.map((row, index) => (
          <Item
            key={row.id ?? row.title_id ?? `${table}-${page}-${index}`}
            variant="outline"
            size="sm"
          >
            <ItemContent>
              <ItemTitle>
                {row.name || row.message || (
                  <ActivityName
                    titleId={row.title_id ?? undefined}
                    installmentId={row.installment_id ?? undefined}
                  />
                )}
              </ItemTitle>
              {row.body && <ItemDescription>{row.body}</ItemDescription>}
              <p className="text-xs text-muted-foreground">
                {dateLabel(row.updated_at ?? row.created_at ?? row.viewed_at ?? null)}
              </p>
              <div className="flex flex-wrap gap-2">
                {row.is_favorite && <Badge variant="secondary">في المفضلة</Badge>}
                {row.is_played !== undefined && (
                  <Badge variant="outline">{row.is_played ? "مشاهَد" : "قيد المشاهدة"}</Badge>
                )}
                {row.position_seconds !== undefined && (
                  <Badge variant="outline">
                    {Math.floor(row.position_seconds / 60).toLocaleString("ar")} دقيقة مسجّلة
                  </Badge>
                )}
                {row.visit_count !== undefined && (
                  <Badge variant="outline">{row.visit_count.toLocaleString("ar")} زيارة</Badge>
                )}
                {row.personal_rating != null && (
                  <Badge variant="outline">تقييم شخصي {row.personal_rating}</Badge>
                )}
              </div>
            </ItemContent>
          </Item>
        ))}
        {query.data && (
          <RecordsPager
            page={page}
            total={query.data.total}
            pageSize={query.data.pageSize}
            pending={query.isFetching}
            onChange={setPage}
          />
        )}
      </div>
    </AccountPanel>
  );
}
