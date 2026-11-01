import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  Clock3,
  MailPlus,
  Monitor,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AccountAvatar } from "@/features/account/account-avatar";

import {
  AccountIdentity,
  AccessPanel,
  PreferencesPanel,
  SessionsPanel,
  ViewingRecords,
} from "./account-details";
import {
  accountKinds,
  accountSchema,
  accountStatuses,
  dateLabel,
  deviceSchema,
  inviteSchema,
  recordOptions,
  roleLabel,
  type ManagedAccount,
  type ManagedDevice,
} from "./accounts-data";
import { AccountPanel, Facts, NoRecords, ReadFailure, RecordsPager } from "./accounts-primitives";

const destinations = [
  { value: "accounts", label: "الحسابات", icon: Users },
  { value: "devices", label: "الأجهزة والجلسات", icon: Monitor },
  { value: "invites", label: "الدعوات", icon: MailPlus },
  { value: "policies", label: "الصلاحيات والمحتوى", icon: ShieldCheck },
  { value: "profiles", label: "بيانات المشاهدة", icon: Clock3 },
] as const;

export function AccountsPage({ tab }: { tab: string }) {
  const section = destinations.find((item) => item.value === tab)?.value ?? "accounts";
  return (
    <article className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 p-4 pb-10 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Users className="mt-1 size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">الحسابات والوصول</h1>
            <p className="text-sm text-muted-foreground">
              من يستخدم المكتبة، وما الذي يستطيع الوصول إليه.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* TODO(admin-account-create): Connect account creation to reviewed identity provisioning and credential activation. */}
          <Button variant="outline" size="sm" disabled>
            <UserPlus data-icon="inline-start" />
            إنشاء حساب
          </Button>
          {/* TODO(admin-invites): Implement scoped invite issuance, activation and revocation before enabling this action. */}
          <Button size="sm" disabled>
            <MailPlus data-icon="inline-start" />
            دعوة جديدة
          </Button>
        </div>
      </header>
      <nav aria-label="أقسام الحسابات والوصول" className="flex flex-wrap gap-2">
        {destinations.map((item) => (
          <Button
            key={item.value}
            variant={section === item.value ? "secondary" : "ghost"}
            size="sm"
            render={
              <a
                href={`#/admin/accounts?tab=${item.value}`}
                aria-current={section === item.value ? "page" : undefined}
              />
            }
          >
            <item.icon data-icon="inline-start" />
            {item.label}
          </Button>
        ))}
      </nav>
      <p className="text-xs text-muted-foreground">
        البيانات للقراءة حاليًا؛ الإجراءات المعطّلة قادمة.
      </p>
      <AccountDirectory key={section} section={section} />
    </article>
  );
}

function AccountDirectory({ section }: { section: (typeof destinations)[number]["value"] }) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [account, setAccount] = useState<ManagedAccount | null>(null);
  const [device, setDevice] = useState<ManagedDevice | null>(null);
  const finalFocus = useRef<HTMLElement | null>(null);
  const table =
    section === "devices" ? "devices" : section === "invites" ? "account_invites" : "accounts";
  const query = useQuery(recordOptions(table, page, search));
  const accounts =
    table === "accounts" ? (query.data?.rows.map((row) => accountSchema.parse(row)) ?? []) : [];
  const devices =
    table === "devices" ? (query.data?.rows.map((row) => deviceSchema.parse(row)) ?? []) : [];
  const invites =
    table === "account_invites"
      ? (query.data?.rows.map((row) => inviteSchema.parse(row)) ?? [])
      : [];
  const title =
    section === "devices"
      ? "أجهزة المكتبة"
      : section === "invites"
        ? "دعوات المكتبة"
        : section === "policies"
          ? "اختر حسابًا لمراجعة وصوله"
          : section === "profiles"
            ? "اختر حسابًا لمراجعة بياناته"
            : "حسابات المكتبة";
  const description =
    section === "devices"
      ? "الجهاز قد يستخدمه أكثر من حساب. آخر نشاط مسجّل لا يعني أنه متصل الآن."
      : section === "invites"
        ? "الدعوات المسجّلة وحالتها، دون عرض رموزها أو روابطها السرية."
        : "افتح حسابًا لرؤية بيانات الدخول والجلسات وتفضيلات المشاهدة وحدود المحتوى.";
  return (
    <>
      <AccountPanel title={title} description={description}>
        <div className="flex flex-col gap-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(draft.trim());
              setPage(1);
            }}
          >
            <FieldGroup className="flex-row items-end gap-2">
              <Field className="min-w-0 flex-1">
                <FieldLabel htmlFor="account-search">البحث بالاسم أو المعرّف</FieldLabel>
                <Input
                  id="account-search"
                  value={draft}
                  maxLength={200}
                  placeholder={
                    section === "devices"
                      ? "ابحث عن جهاز…"
                      : section === "invites"
                        ? "ابحث عن دعوة…"
                        : "ابحث عن حساب…"
                  }
                  onChange={(event) => setDraft(event.target.value)}
                />
              </Field>
              <Button type="submit" variant="outline">
                <Search data-icon="inline-start" />
                بحث
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="تحديث القائمة"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                <RefreshCw />
              </Button>
            </FieldGroup>
          </form>
          {query.isPending && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          )}
          {query.error && <ReadFailure error={query.error} retry={() => void query.refetch()} />}
          {query.data && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {search ? "نتائج البحث" : "السجلات"}
              </span>
              <Badge variant="secondary">{query.data.total.toLocaleString("ar")}</Badge>
            </div>
          )}
          {query.data?.rows.length === 0 && (
            <NoRecords
              title={
                search
                  ? "لم نجد نتائج مطابقة"
                  : section === "invites"
                    ? "لا توجد دعوات مسجّلة"
                    : section === "devices"
                      ? "لا توجد أجهزة مسجّلة"
                      : "لا توجد حسابات مسجّلة"
              }
              description={
                search
                  ? "جرّب اسمًا آخر أو امسح البحث."
                  : section === "invites"
                    ? "إصدار الدعوات وتفعيلها سيُتاحان بعد اكتمال إدارة الوصول."
                    : "ستظهر هنا السجلات عندما تُضاف إلى المكتبة."
              }
            />
          )}
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {accounts.map((item) => (
              <Item
                key={item.id}
                variant="outline"
                render={<button type="button" />}
                aria-label={`فتح حساب ${item.display_name}`}
                onClick={(event) => {
                  finalFocus.current = event.currentTarget;
                  setAccount(item);
                }}
              >
                <ItemMedia>
                  <AccountAvatar
                    name={item.display_name}
                    avatarKey={item.avatar_key}
                    className="size-11"
                  />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{item.display_name}</ItemTitle>
                  <ItemDescription>
                    {accountKinds[item.kind]} · آخر نشاط {dateLabel(item.last_seen_at)}
                  </ItemDescription>
                </ItemContent>
                <Badge variant={item.status === "active" ? "secondary" : "outline"}>
                  {accountStatuses[item.status]}
                </Badge>
                <ChevronLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Item>
            ))}
            {devices.map((item) => (
              <Item
                key={item.id}
                variant="outline"
                render={<button type="button" />}
                aria-label={`فتح جهاز ${item.name || item.platform}`}
                onClick={(event) => {
                  finalFocus.current = event.currentTarget;
                  setDevice(item);
                }}
              >
                <ItemMedia variant="icon">
                  <Monitor />
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{item.name || "جهاز دون اسم"}</ItemTitle>
                  <ItemDescription>
                    {item.platform} · آخر نشاط {dateLabel(item.last_seen_at)}
                  </ItemDescription>
                </ItemContent>
                <Badge variant="outline">{item.revoked_at ? "أُلغي الوصول" : "مسجّل"}</Badge>
              </Item>
            ))}
            {invites.map((item) => (
              <Item key={item.id} variant="outline">
                <ItemMedia variant="icon">
                  <MailPlus />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{item.display_name}</ItemTitle>
                  <ItemDescription>
                    {item.username} · {roleLabel(item.role)}
                  </ItemDescription>
                  <p className="text-xs text-muted-foreground">
                    تنتهي {dateLabel(item.expires_at)}
                  </p>
                </ItemContent>
                <Badge variant="outline">
                  {item.accepted_at
                    ? "مقبولة"
                    : new Date(item.expires_at).getTime() < query.dataUpdatedAt
                      ? "منتهية"
                      : "بانتظار القبول"}
                </Badge>
                {/* TODO(admin-invite-revoke): Add revocation with review; never expose or reconstruct stored invite tokens. */}
                <Button variant="outline" size="sm" disabled>
                  إلغاء الدعوة
                </Button>
              </Item>
            ))}
          </div>
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
      <Drawer
        open={Boolean(account || device)}
        onOpenChange={(open) => {
          if (!open) {
            setAccount(null);
            setDevice(null);
          }
        }}
      >
        <DrawerContent finalFocus={finalFocus} className="mx-auto max-h-11/12 w-full max-w-3xl">
          <DrawerHeader>
            <DrawerTitle>{account?.display_name ?? device?.name ?? "تفاصيل الجهاز"}</DrawerTitle>
            <DrawerDescription>
              {account
                ? "بيانات الحساب والوصول المرتبطة به. التعديلات الإدارية غير متاحة بعد."
                : "الجهاز مشترك على مستوى المكتبة؛ الجلسات مرتبطة بحساباتها."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-4 sm:px-6">
            {account && <AccountContents key={account.id} account={account} section={section} />}
            {device && (
              <>
                <AccountPanel
                  title="بيانات الجهاز"
                  description="معلومات التسجيل والنشاط التي يحتفظ بها الخادم."
                >
                  <Facts
                    entries={[
                      ["الاسم", device.name || "دون اسم"],
                      ["المنصة", device.platform],
                      ["آخر نشاط مسجّل", dateLabel(device.last_seen_at)],
                      ["تاريخ التسجيل", dateLabel(device.created_at)],
                      [
                        "الوصول",
                        device.revoked_at
                          ? `أُلغي في ${dateLabel(device.revoked_at)}`
                          : "لم يُلغَ تسجيل الجهاز",
                      ],
                    ]}
                  />
                  {/* TODO(admin-device-revoke): Implement reviewed device revocation with linked-session invalidation and ownership guards. */}
                  <Button className="mt-4" variant="outline" size="sm" disabled>
                    إلغاء وصول الجهاز
                  </Button>
                </AccountPanel>
                <SessionsPanel key={device.id} field="device_id" value={device.id} />
              </>
            )}
          </div>
          <DrawerFooter>
            <DrawerClose render={<Button variant="outline" />}>إغلاق</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
const accountViews = [
  { value: "identity", label: "البيانات" },
  { value: "sessions", label: "الجلسات" },
  { value: "access", label: "الصلاحيات والمحتوى" },
  { value: "viewing", label: "المشاهدة والتفاعل" },
] as const;
function AccountContents({ account, section }: { account: ManagedAccount; section: string }) {
  const [view, setView] = useState(
    section === "policies" ? "access" : section === "profiles" ? "viewing" : "identity",
  );
  return (
    <>
      <ToggleGroup
        aria-label="تفاصيل الحساب"
        value={[view]}
        onValueChange={(values) => {
          if (values[0]) setView(values[0]);
        }}
        className="w-full flex-wrap"
        variant="outline"
        size="sm"
      >
        {accountViews.map((item) => (
          <ToggleGroupItem key={item.value} value={item.value}>
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {view === "identity" && <AccountIdentity account={account} />}
      {view === "sessions" &&
        (account.auth_user_id ? (
          <SessionsPanel field="user_id" value={account.auth_user_id} name={account.display_name} />
        ) : (
          <NoRecords
            title="لا توجد هوية دخول مرتبطة"
            description="تظهر الجلسات بعد تفعيل حساب الدخول وربطه بهذا الملف."
          />
        ))}
      {view === "access" && <AccessPanel account={account} />}
      {view === "viewing" && (
        <>
          <PreferencesPanel accountId={account.id} />
          <ViewingRecords accountId={account.id} />
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" render={<a href={`#/profiles/${account.id}`} />}>
          فتح الملف الشخصي
        </Button>
      </div>
    </>
  );
}
