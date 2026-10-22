import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleHelp,
  Globe2,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  ChevronLeft,
} from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import {
  connectionKey,
  connectionsOptions,
  probeOptions,
  probeServer,
  selectServer,
  updateServer,
} from "./connections";
import type { SavedServer } from "./connections";

export function CurrentServer({
  onManage,
  disabled = false,
  sessionError,
}: {
  onManage: () => void;
  disabled?: boolean;
  sessionError?: string;
}) {
  const connections = useQuery(connectionsOptions());
  const current = connections.data?.servers.find(
    (server) => server.url === connections.data.selected,
  );
  const status = useQuery(probeOptions(current?.url));
  const error = connections.error?.message ?? status.error?.message ?? sessionError;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-3">
        <Server className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{current?.name ?? "اختر مكتبتك"}</p>
          <p className="truncate text-xs text-muted-foreground" dir="ltr" title={current?.url}>
            {current?.url ?? "أضف عنوان خادم المكتبة"}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onManage} disabled={disabled}>
          تغيير
          <ChevronLeft data-icon="inline-end" />
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs" aria-live="polite">
        <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
          {status.isFetching ? (
            <>
              <Spinner /> جارٍ التحقق من الاتصال…
            </>
          ) : error ? (
            sessionError && !connections.error && !status.error ? (
              "تعذّرت استعادة الجلسة"
            ) : (
              "تعذّر الاتصال بالمكتبة"
            )
          ) : status.data ? (
            <>
              <CheckCircle2 className="size-3.5 shrink-0 text-success" /> متصل بالمكتبة
            </>
          ) : (
            "اختر مكتبة للمتابعة"
          )}
        </span>
        {!status.isFetching && current && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="إعادة فحص الاتصال"
            disabled={disabled}
            onClick={() => void status.refetch()}
          >
            <RefreshCw />
          </Button>
        )}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ConnectionForm({
  editing,
  onDone,
  onBusyChange,
}: {
  editing: SavedServer | null;
  onDone: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [url, setUrl] = useState(editing?.url ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [certificate, setCertificate] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const trust = certificate.trim() || fingerprint.trim() ? { certificate, fingerprint } : undefined;
  const client = useQueryClient();
  const test = useMutation({
    mutationFn: () => probeServer(url, undefined, trust),
    networkMode: "always",
  });
  const save = useMutation({
    onMutate: () => onBusyChange(true),
    onSettled: () => onBusyChange(false),
    mutationFn: () =>
      editing
        ? updateServer("servers.save", { url, name: name.trim() })
        : selectServer(client, { url, name: name.trim(), trust }),
    networkMode: "always",
    onSuccess: (state) => {
      client.setQueryData(connectionKey, state);
      onDone();
    },
  });
  const busy = test.isPending || save.isPending;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) save.mutate();
      }}
      className="flex flex-col gap-6"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="server-url">عنوان الخادم</FieldLabel>
          <Input
            id="server-url"
            dir="ltr"
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            maxLength={2048}
            placeholder="https://nahhasio.home"
            value={url}
            readOnly={Boolean(editing)}
            disabled={busy}
            required
            onChange={(event) => {
              setUrl(event.target.value);
              test.reset();
              save.reset();
            }}
          />
          <FieldDescription>
            {editing
              ? "لتغيير العنوان، أضف اتصالًا جديدًا؛ الجلسات مرتبطة بعناوين خوادمها."
              : "HTTPS لخادم الشبكة. للتجربة على هذا الجهاز: http://127.0.0.1:23103"}
          </FieldDescription>
        </Field>
        {!editing && (
          <Collapsible>
            <CollapsibleTrigger render={<Button type="button" variant="outline" disabled={busy} />}>
              شهادة خادم منزلي
            </CollapsibleTrigger>
            <CollapsibleContent>
              <FieldGroup className="mt-4">
                <Field>
                  <FieldLabel htmlFor="server-certificate">شهادة الجذر العامة (PEM)</FieldLabel>
                  <Textarea
                    id="server-certificate"
                    dir="ltr"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={8192}
                    value={certificate}
                    disabled={busy}
                    rows={4}
                    onChange={(event) => {
                      setCertificate(event.target.value);
                      test.reset();
                      save.reset();
                    }}
                  />
                  <FieldDescription>
                    انسخ الشهادة العامة فقط من جهاز الخادم. لا تُدخل أي مفتاح خاص. تُحفظ الثقة لهذا
                    العنوان وحده.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="server-fingerprint">بصمة شهادة الجذر SHA-256</FieldLabel>
                  <Input
                    id="server-fingerprint"
                    dir="ltr"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={128}
                    value={fingerprint}
                    disabled={busy}
                    onChange={(event) => {
                      setFingerprint(event.target.value);
                      test.reset();
                      save.reset();
                    }}
                  />
                  <FieldDescription>
                    انقل البصمة من شاشة الخادم أو عبر SSH موثوق. تُرفض الشهادة عند عدم تطابقها؛ يستمر
                    التحقق من اسم الخادم وصلاحية اتصاله.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CollapsibleContent>
          </Collapsible>
        )}
        <Field>
          <FieldLabel htmlFor="server-name">اسم الاتصال {editing ? "" : "(اختياري)"}</FieldLabel>
          <Input
            id="server-name"
            maxLength={80}
            autoComplete="off"
            placeholder="مكتبة البيت"
            value={name}
            required={Boolean(editing)}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
      </FieldGroup>
      {editing?.trustedFingerprint && (
        <Alert>
          <ShieldCheck />
          <AlertTitle>ثقة خاصة بهذا الخادم</AlertTitle>
          <AlertDescription>
            <bdi className="break-all font-mono text-xs">{editing.trustedFingerprint}</bdi>
            <p>لتغيير شهادة الجذر، اختر خادماً آخر ثم أزل هذا الاتصال وأضفه بالشهادة الجديدة.</p>
          </AlertDescription>
        </Alert>
      )}
      {test.data && !test.error && (
        <Alert>
          <ShieldCheck />
          <AlertTitle>الخادم جاهز للاتصال</AlertTitle>
          <AlertDescription>
            {test.data.info.name} · <span dir="ltr">v{test.data.info.version}</span>
          </AlertDescription>
        </Alert>
      )}
      {(test.error || save.error) && (
        <Alert variant="destructive">
          <AlertDescription>{save.error?.message ?? test.error?.message}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" disabled={busy} onClick={onDone}>
          رجوع
        </Button>
        {!editing && (
          <Button
            type="button"
            variant="outline"
            disabled={busy || !url.trim()}
            onClick={() => test.mutate()}
          >
            {test.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Globe2 data-icon="inline-start" />
            )}
            اختبار الاتصال
          </Button>
        )}
        <Button type="submit" disabled={busy || !url.trim()}>
          {save.isPending ? <Spinner data-icon="inline-start" /> : null}
          {editing ? "حفظ الاسم" : "اتصال بالمكتبة"}
          {!editing && <ArrowLeft data-icon="inline-end" />}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ServerConnections({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useQueryClient();
  const connections = useQuery({ ...connectionsOptions(), enabled: open });
  const [formBusy, setFormBusy] = useState(false);
  const [form, setForm] = useState<{ editing: SavedServer | null } | null>(null);
  const [removing, setRemoving] = useState<SavedServer | null>(null);
  const select = useMutation({
    mutationFn: (server: SavedServer) => selectServer(client, server),
    networkMode: "always",
    onSuccess: () => onOpenChange(false),
  });
  const remove = useMutation({
    mutationFn: (server: SavedServer) => updateServer("servers.remove", server),
    networkMode: "always",
    onSuccess: (state) => {
      client.setQueryData(connectionKey, state);
      setRemoving(null);
    },
  });
  const change = (next: boolean) => {
    if (select.isPending || remove.isPending || formBusy) return;
    onOpenChange(next);
    if (!next) {
      setForm(null);
      setRemoving(null);
      select.reset();
      remove.reset();
    }
  };
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {form ? (form.editing ? "تسمية الاتصال" : "أضف مكتبتك") : "اختر مكتبتك"}
          </DialogTitle>
          <DialogDescription>
            {form
              ? "اتصل بالخادم الذي يحتفظ بأعمالك وصورك وسجل مشاهدتك."
              : "اتصل بمكتبتك للمتابعة. ملفات هذا الجهاز تبقى محفوظة عند التبديل."}
          </DialogDescription>
        </DialogHeader>
        {form ? (
          <ConnectionForm
            key={form.editing?.url ?? "new"}
            editing={form.editing}
            onBusyChange={setFormBusy}
            onDone={() => setForm(null)}
          />
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {connections.data?.servers.map((server) => (
                <div
                  key={server.url}
                  className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border p-4 data-[selected=true]:border-primary/50 data-[selected=true]:bg-primary/5"
                  data-selected={connections.data.selected === server.url}
                >
                  <Server
                    className="mx-1 size-6 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="min-w-0 break-words">{server.name}</span>
                      {connections.data.selected === server.url && (
                        <Badge variant="secondary">
                          <Check data-icon="inline-start" />
                          الحالي
                        </Badge>
                      )}
                    </p>
                    <p
                      className="truncate text-xs text-muted-foreground"
                      dir="ltr"
                      title={server.url}
                    >
                      {server.url}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`تسمية ${server.name}`}
                    disabled={select.isPending || remove.isPending}
                    onClick={() => setForm({ editing: server })}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`إزالة ${server.name}`}
                    title={
                      connections.data.selected === server.url
                        ? "اختر خادمًا آخر قبل إزالة الاتصال الحالي"
                        : "إزالة الاتصال المحفوظ"
                    }
                    disabled={
                      connections.data.selected === server.url ||
                      select.isPending ||
                      remove.isPending
                    }
                    onClick={() => {
                      setRemoving(server);
                      remove.reset();
                    }}
                  >
                    <Trash2 />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={
                      connections.data.selected === server.url ||
                      select.isPending ||
                      remove.isPending
                    }
                    onClick={() => select.mutate(server)}
                  >
                    {select.isPending && select.variables?.url === server.url ? (
                      <Spinner />
                    ) : (
                      "اتصال"
                    )}
                  </Button>
                </div>
              ))}
            </div>
            {removing && (
              <Alert>
                <CircleHelp />
                <AlertTitle>إزالة «{removing.name}» من هذا الجهاز؟</AlertTitle>
                <AlertDescription>
                  تُزال الجلسة المحفوظة لهذا الاتصال. لا يُحذف الحساب أو الخادم أو ملفات الفيديو.
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(removing)}
                    >
                      {remove.isPending ? <Spinner /> : "إزالة الاتصال"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={remove.isPending}
                      onClick={() => setRemoving(null)}
                    >
                      إلغاء
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {(connections.error || select.error || remove.error) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {select.error?.message ?? remove.error?.message ?? connections.error?.message}
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                type="button"
                onClick={() => setForm({ editing: null })}
                disabled={
                  select.isPending ||
                  remove.isPending ||
                  (connections.data?.servers.length ?? 0) >= 8
                }
              >
                <Plus data-icon="inline-start" />
                إضافة خادم
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
