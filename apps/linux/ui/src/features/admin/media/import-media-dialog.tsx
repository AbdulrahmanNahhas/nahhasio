import { rpcResults } from "@arcadia/contracts/editor-rpc";
import type { MediaImportRequest } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpenIcon, UploadIcon, PlayIcon, FilmIcon, PlusIcon } from "lucide-react";
import { useState, type ReactElement } from "react";
import { z } from "zod";

import { Choice } from "@/components/choice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxGroup,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { invalidateCatalogEdit } from "@/features/editor/invalidate-catalog-edit";
import { ChangeReview } from "@/features/editor/json/document/change-review";
import { gateway } from "@/lib/bridge";

import { episodeNumber, episodeTitle } from "./filename";
import { importMedia, incomingOptions } from "./media-data";
import { CreateMediaPart } from "./structure-dialog";
import { UploadPanel } from "./upload-panel";
import { YoutubeImport } from "./youtube-import";

export function ImportMediaDialog({
  children,
  workId,
  installmentId,
  episodeId,
}: {
  children: ReactElement;
  workId?: string;
  installmentId?: string;
  episodeId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
        <DialogHeader className="pe-10">
          <DialogTitle>استيراد فيديوهات إلى الخادم</DialogTitle>
          <DialogDescription className="sr-only">
            حدّد المصدر والوجهة، ثم عاين الفيديوهات وراجع ربطها قبل الاستيراد.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ImportForm
            initialWorkId={workId}
            initialPartId={installmentId}
            initialEpisodeId={episodeId}
            onComplete={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
function ImportForm({
  onComplete,
  initialWorkId,
  initialPartId,
  initialEpisodeId,
}: {
  onComplete: () => void;
  initialWorkId?: string;
  initialPartId?: string;
  initialEpisodeId?: string;
}) {
  const [source, setSource] = useState("server");
  const client = useQueryClient();
  const [query, setQuery] = useState("");
  const [workId, setWorkId] = useState(initialWorkId ?? "");
  const [chosenPartId, setPartId] = useState(initialPartId ?? "");
  const [folder, setFolder] = useState("");
  const [sourceRoot, setSourceRoot] = useState<"incoming" | "library">("incoming");
  const [page, setPage] = useState(1);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [copy, setCopy] = useState(false);
  const [review, setReview] = useState(false);
  const [draftEpisodes, setDraftEpisodes] = useState<
    Record<string, { number: number; title: string }>
  >({});
  const [prepared, setPrepared] = useState<{
    ticket: string | null;
    review: z.infer<typeof rpcResults.review> | null;
    request: MediaImportRequest;
  } | null>(null);
  const works = useQuery({
    queryKey: ["admin", "import-works", query],
    queryFn: ({ signal }) => gateway.adminWorks({ q: query, page: 1, pageSize: 30 }, signal),
  });
  const work = useQuery({
    queryKey: ["admin", "import-work", workId],
    queryFn: ({ signal }) => gateway.work(workId, signal),
    enabled: Boolean(workId),
  });
  const workChoices = (works.data?.items ?? []).map((item) => ({
    id: item.id,
    label: item.titleAr || item.canonicalTitle,
    subtitle: item.titleAr ? item.canonicalTitle : "",
  }));
  const selectedWork =
    workChoices.find((item) => item.id === workId) ??
    (work.data
      ? {
          id: work.data.id,
          label: work.data.titleAr || work.data.canonicalTitle,
          subtitle: work.data.titleAr ? work.data.canonicalTitle : "",
        }
      : null);
  const partId =
    chosenPartId || (work.data?.installments.length === 1 ? work.data.installments[0]!.id : "");
  const incoming = useQuery({
    ...incomingOptions(source === "upload" ? "uploads" : folder, sourceRoot, page),
    enabled: Boolean(partId) && source !== "youtube",
    refetchInterval: source === "upload" ? 5000 : false,
  });
  const part = work.data?.installments.find((candidate) => candidate.id === partId);
  const selected =
    incoming.data?.files.filter((file) => mapping[file.relativePath] !== undefined) ?? [];
  const prepare = useMutation({
    mutationFn: async () => {
      const rows = rpcResults.read.parse(
        await gateway.editorCall({ operation: "read", data: { ids: [workId] } }),
      );
      const snapshot = rows[0];
      if (!snapshot) throw new Error("تعذّر تحميل العمل.");
      const installments = structuredClone(snapshot.document.installments ?? []);
      const draft = installments.find((candidate) => candidate.id === partId);
      if (!draft) throw new Error("تغيّر الجزء؛ أعد تحميل العمل.");
      const items: MediaImportRequest["items"] = [];
      const targets = new Set<string>();
      for (const file of selected) {
        let id = mapping[file.relativePath];
        if (part?.kind === "season" && id === "new") {
          const fields = draftEpisodes[file.relativePath] ?? {
            number: episodeNumber(file.relativePath) ?? 0,
            title: episodeTitle(file.relativePath),
          };
          if (!fields.number || fields.number < 0)
            throw new Error("أدخل رقمًا موجبًا لكل حلقة جديدة.");
          if (draft.episodes?.some((existing) => existing.number === fields.number))
            throw new Error("يوجد رقم حلقة مطابق؛ اربط الملف بالحلقة الموجودة.");
          id = crypto.randomUUID();
          draft.episodes = [
            ...(draft.episodes ?? []),
            {
              id,
              number: fields.number,
              title: fields.title,
              position:
                Math.max(0, ...(draft.episodes ?? []).map((existing) => existing.position ?? 0)) +
                1,
              summary: "",
            },
          ];
        }
        const target = part?.kind === "season" ? id : partId;
        if (targets.has(target)) throw new Error("حدّد ملفًا واحدًا لكل حلقة؛ راجع الربط المكرّر.");
        targets.add(target);
        items.push({
          ...file,
          sourceRoot,
          installmentId: partId,
          episodeId: part?.kind === "season" ? id : null,
          copy,
        });
      }
      const changed =
        JSON.stringify(installments) !== JSON.stringify(snapshot.document.installments ?? []);
      const result = changed
        ? rpcResults.review.parse(
            await gateway.editorCall({
              operation: "review",
              data: {
                json: JSON.stringify({
                  schemaVersion: 1,
                  fields: ["installments"],
                  records: [{ id: workId, installments }],
                }),
                originals: [{ id: workId, revision: snapshot.revision }],
              },
            }),
          )
        : null;
      return {
        ticket: result?.ticket ?? null,
        review: result,
        request: { workId, items, idempotencyKey: crypto.randomUUID() },
      };
    },
    onSuccess: (result) => {
      setPrepared(result);
      setReview(true);
    },
  });
  const action = useMutation({
    mutationFn: async () => {
      if (!prepared) throw new Error("راجع الاستيراد أولًا.");
      if (prepared.ticket)
        await gateway.editorCall({ operation: "save", data: { ticket: prepared.ticket } });
      return importMedia(prepared.request);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["admin", "media"] });
      if (prepared?.ticket) await invalidateCatalogEdit(client);
      await client.invalidateQueries({ queryKey: ["admin", "import-work", workId] });
      onComplete();
    },
  });
  return (
    <>
      <Field>
        <FieldLabel id="import-source-label" className="sr-only">
          مصدر الفيديوهات
        </FieldLabel>
        <ToggleGroup
          aria-labelledby="import-source-label"
          variant="outline"
          className="flex-wrap"
          value={[source]}
          onValueChange={(values) => {
            const value = values[0];
            if (!value) return;
            setSource(value);
            setSourceRoot("incoming");
            setFolder("");
            setPage(1);
            setMapping({});
            setReview(false);
          }}
        >
          <ToggleGroupItem value="server" aria-label="ملفات الخادم">
            <FolderOpenIcon data-icon="inline-start" /> ملفات الخادم
          </ToggleGroupItem>
          <ToggleGroupItem value="upload" aria-label="رفع من الجهاز">
            <UploadIcon data-icon="inline-start" /> رفع من الجهاز
          </ToggleGroupItem>
          <ToggleGroupItem value="youtube" aria-label="YouTube">
            <PlayIcon data-icon="inline-start" /> YouTube
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <div className="grid items-start gap-4 md:grid-cols-3">
        <Card size="sm" className="min-w-0">
          <CardHeader>
            <CardTitle>وجهة الفيديوهات</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="import-work-picker">العمل</FieldLabel>
                <Combobox
                  items={workChoices}
                  value={selectedWork}
                  filter={null}
                  itemToStringLabel={(item) => item.label}
                  itemToStringValue={(item) => item.id}
                  isItemEqualToValue={(item, value) => item.id === value.id}
                  onInputValueChange={(text, details) => {
                    if (details.reason === "input-change") setQuery(text);
                  }}
                  onValueChange={(item) => {
                    setWorkId(item?.id ?? "");
                    setQuery("");
                    setPartId("");
                    setMapping({});
                    setReview(false);
                  }}
                >
                  <ComboboxInput
                    id="import-work-picker"
                    aria-label="البحث عن عمل"
                    placeholder="ابحث واختر عملًا…"
                    showClear
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>
                      {works.isFetching
                        ? "جارٍ البحث…"
                        : works.isError
                          ? "تعذّر البحث"
                          : "لا توجد أعمال مطابقة"}
                    </ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxGroup>
                        {workChoices.map((item) => (
                          <ComboboxItem key={item.id} value={item}>
                            <span className="flex min-w-0 flex-col gap-1">
                              <span className="truncate" dir="auto">
                                {item.label}
                              </span>
                              {item.subtitle && (
                                <span className="truncate text-xs text-muted-foreground" dir="auto">
                                  {item.subtitle}
                                </span>
                              )}
                            </span>
                          </ComboboxItem>
                        ))}
                      </ComboboxGroup>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </Field>
              {work.data && (
                <Field>
                  <FieldLabel>الجزء</FieldLabel>
                  <Choice
                    label="الجزء المستهدف"
                    value={partId}
                    onChange={(id) => {
                      setPartId(id);
                      setMapping({});
                      setReview(false);
                    }}
                    options={work.data.installments.map((candidate) => ({
                      value: candidate.id,
                      label: candidate.title,
                    }))}
                  />
                </Field>
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-wrap gap-2">
            {part && (
              <Badge variant="secondary">
                {part.kind === "season"
                  ? `${part.episodes.length} حلقة في المكتبة`
                  : "فيلم أو حلقة خاصة"}
              </Badge>
            )}
            {workId && (
              <CreateMediaPart
                workId={workId}
                onSaved={(id) => {
                  void client.invalidateQueries({ queryKey: ["admin", "import-work", workId] });
                  setPartId(id);
                  setMapping({});
                  setReview(false);
                }}
              >
                <Button variant="ghost" size="sm">
                  <PlusIcon data-icon="inline-start" />
                  إضافة جزء جديد
                </Button>
              </CreateMediaPart>
            )}
          </CardFooter>
        </Card>
        <Card size="sm" className="min-w-0 md:col-span-2">
          <CardHeader>
            <CardTitle>
              {source === "youtube"
                ? "فيديوهات YouTube"
                : source === "upload"
                  ? "رفع الفيديوهات"
                  : "تصفّح ملفات الخادم"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {source === "upload" && <UploadPanel />}
            {!part && (
              <Empty className="p-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FilmIcon />
                  </EmptyMedia>
                  <EmptyTitle>أين ستظهر الفيديوهات؟</EmptyTitle>
                  <EmptyDescription>اختر العمل والجزء للمتابعة.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            <FieldGroup className="gap-4">
              {part && source !== "youtube" && (
                <>
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    {source === "server" && (
                      <Field>
                        <FieldLabel>الموقع</FieldLabel>
                        <Choice
                          label="موقع ملفات الخادم"
                          value={sourceRoot}
                          onChange={(value) => {
                            setSourceRoot(z.enum(["incoming", "library"]).parse(value));
                            setFolder("");
                            setPage(1);
                            setMapping({});
                            setReview(false);
                          }}
                          options={[
                            { value: "incoming", label: "الملفات الواردة" },
                            { value: "library", label: "ملفات المكتبة غير المرتبطة" },
                          ]}
                        />
                      </Field>
                    )}
                    {source === "server" && (
                      <Field>
                        <FieldLabel htmlFor="import-folder">المجلد</FieldLabel>
                        <Input
                          id="import-folder"
                          placeholder="المجلد الرئيسي"
                          value={folder}
                          onChange={(event) => {
                            setFolder(event.target.value);
                            setPage(1);
                            setMapping({});
                            setReview(false);
                          }}
                          dir="ltr"
                        />
                      </Field>
                    )}
                  </FieldGroup>
                  <div className="flex flex-wrap gap-2">
                    {source === "server" && folder && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFolder(folder.split("/").slice(0, -1).join("/"));
                          setPage(1);
                          setMapping({});
                          setReview(false);
                        }}
                      >
                        المجلد الأعلى
                      </Button>
                    )}
                    {incoming.data?.folders.map((name) => (
                      <Button
                        key={name}
                        variant="outline"
                        onClick={() => {
                          setFolder(name);
                          setPage(1);
                          setMapping({});
                          setReview(false);
                        }}
                      >
                        {name.split("/").at(-1)}
                      </Button>
                    ))}
                  </div>
                  {Boolean(incoming.data?.files.length) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => {
                        const next: Record<string, string> = {};
                        for (const candidate of incoming.data?.files ?? []) {
                          const number = episodeNumber(candidate.relativePath);
                          if (number) {
                            const matches = part.episodes.filter(
                              (episode) => Number(episode.number) === number,
                            );
                            next[candidate.relativePath] =
                              matches.length === 1 ? matches[0]!.id : "new";
                          }
                        }
                        setMapping(next);
                        setReview(false);
                      }}
                    >
                      ربط تلقائي من أسماء الملفات
                    </Button>
                  )}
                  {incoming.data?.files.map((file) => (
                    <Field key={file.relativePath}>
                      <FieldLabel>
                        <Checkbox
                          checked={mapping[file.relativePath] !== undefined}
                          onCheckedChange={(checked) => {
                            setMapping((previous) => {
                              const next = { ...previous };
                              if (checked)
                                next[file.relativePath] =
                                  workId === initialWorkId && partId === initialPartId
                                    ? (initialEpisodeId ?? "")
                                    : "";
                              else delete next[file.relativePath];
                              return next;
                            });
                            setReview(false);
                          }}
                        />
                        {file.relativePath.split("/").at(-1)}
                      </FieldLabel>
                      {mapping[file.relativePath] !== undefined && part.kind === "season" && (
                        <Choice
                          label={`حلقة الملف ${file.relativePath}`}
                          value={mapping[file.relativePath] ?? ""}
                          onChange={(id) => {
                            setMapping((previous) => ({ ...previous, [file.relativePath]: id }));
                            setReview(false);
                          }}
                          options={[
                            { value: "new", label: "إنشاء حلقة جديدة" },
                            ...part.episodes.map((episode) => ({
                              value: episode.id,
                              label: `${episode.number} · ${episode.title ?? "حلقة"}`,
                            })),
                          ]}
                        />
                      )}
                      {mapping[file.relativePath] === "new" && (
                        <FieldGroup className="grid gap-3 sm:grid-cols-2">
                          <Field>
                            <FieldLabel>رقم الحلقة الجديدة</FieldLabel>
                            <Input
                              aria-label={`رقم الحلقة ${file.relativePath}`}
                              type="number"
                              min={1}
                              value={
                                draftEpisodes[file.relativePath]?.number ??
                                episodeNumber(file.relativePath) ??
                                ""
                              }
                              onChange={(event) => {
                                setDraftEpisodes((previous) => ({
                                  ...previous,
                                  [file.relativePath]: {
                                    title:
                                      previous[file.relativePath]?.title ??
                                      episodeTitle(file.relativePath),
                                    number: Number(event.target.value),
                                  },
                                }));
                                setReview(false);
                              }}
                            />
                          </Field>
                          <Field>
                            <FieldLabel>عنوان الحلقة الجديدة</FieldLabel>
                            <Input
                              aria-label={`عنوان الحلقة ${file.relativePath}`}
                              value={
                                draftEpisodes[file.relativePath]?.title ??
                                episodeTitle(file.relativePath)
                              }
                              onChange={(event) => {
                                setDraftEpisodes((previous) => ({
                                  ...previous,
                                  [file.relativePath]: {
                                    number:
                                      previous[file.relativePath]?.number ??
                                      episodeNumber(file.relativePath) ??
                                      0,
                                    title: event.target.value,
                                  },
                                }));
                                setReview(false);
                              }}
                            />
                          </Field>
                        </FieldGroup>
                      )}
                    </Field>
                  ))}
                  {incoming.data && incoming.data.total > incoming.data.pageSize && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        disabled={page === 1 || incoming.isFetching}
                        onClick={() => {
                          setPage(page - 1);
                          setMapping({});
                          setReview(false);
                        }}
                      >
                        الصفحة السابقة
                      </Button>
                      <p role="status">
                        صفحة {page} من {Math.ceil(incoming.data.total / incoming.data.pageSize)}.
                        اختيار الملفات خاص بالصفحة الحالية.
                      </p>
                      <Button
                        variant="outline"
                        disabled={!incoming.data.truncated || incoming.isFetching}
                        onClick={() => {
                          setPage(page + 1);
                          setMapping({});
                          setReview(false);
                        }}
                      >
                        الصفحة التالية
                      </Button>
                    </div>
                  )}
                  <Field orientation="horizontal">
                    <Checkbox
                      id="import-copy"
                      checked={copy}
                      onCheckedChange={(checked) => {
                        setCopy(Boolean(checked));
                        setReview(false);
                      }}
                    />
                    <FieldLabel htmlFor="import-copy">نسخ الملفات مع الاحتفاظ بالأصل</FieldLabel>
                  </Field>
                  {selected.length > 0 && (
                    <FieldDescription>
                      {selected.length} ملف محدد · {copy ? "نسخ" : "نقل"} إلى المكتبة
                    </FieldDescription>
                  )}
                </>
              )}
            </FieldGroup>
            {part && work.data && source === "youtube" && (
              <YoutubeImport
                key={`${workId}:${partId}`}
                work={work.data}
                partId={partId}
                onComplete={onComplete}
              />
            )}
          </CardContent>
        </Card>
      </div>
      {(works.error || work.error || incoming.error || action.error || prepare.error) && (
        <Alert variant="destructive">
          <AlertDescription>
            {
              (works.error ?? work.error ?? incoming.error ?? action.error ?? prepare.error)
                ?.message
            }
          </AlertDescription>
        </Alert>
      )}
      {review && (
        <Alert>
          <AlertDescription>
            سيُستورد {selected.length} ملفًا إلى «{work.data?.titleAr ?? work.data?.canonicalTitle}» /
            «{part?.title}». تبقى الحلقات الموجودة وصورها محفوظة؛ تُراجع الحلقات الجديدة أدناه قبل
            إنشائها.
          </AlertDescription>
        </Alert>
      )}
      {source !== "youtube" && review && prepared?.review && (
        <ChangeReview
          review={prepared.review}
          onBack={() => setReview(false)}
          onSave={() => action.mutate()}
          busy={action.isPending}
        />
      )}
      {source !== "youtube" && selected.length > 0 && !(review && prepared?.review) && (
        <DialogFooter>
          <Button
            disabled={
              !selected.length ||
              action.isPending ||
              prepare.isPending ||
              selected.some((file) => part?.kind === "season" && !mapping[file.relativePath])
            }
            onClick={() => (review ? action.mutate() : prepare.mutate())}
          >
            {action.isPending ? "جارٍ إرسال المهمة…" : review ? "تأكيد الاستيراد" : "مراجعة الاستيراد"}
          </Button>
        </DialogFooter>
      )}
    </>
  );
}
