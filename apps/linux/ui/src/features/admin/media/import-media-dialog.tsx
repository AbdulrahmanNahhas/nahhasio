import { rpcResults } from "@arcadia/contracts/editor-rpc";
import type { MediaImportRequest } from "@nahhasio/api-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { z } from "zod";

import { Choice } from "@/components/choice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
}: {
  children: ReactElement;
  workId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>استيراد فيديوهات إلى الخادم</DialogTitle>
          <DialogDescription>
            اختر عملًا موجودًا، ثم راجع الملفات وربط الحلقات قبل بدء الاستيراد.
          </DialogDescription>
        </DialogHeader>
        {open && <ImportForm initialWorkId={workId} onComplete={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}
function ImportForm({
  onComplete,
  initialWorkId,
}: {
  onComplete: () => void;
  initialWorkId?: string;
}) {
  const [source, setSource] = useState("server");
  const client = useQueryClient();
  const [query, setQuery] = useState("");
  const [workId, setWorkId] = useState(initialWorkId ?? "");
  const [partId, setPartId] = useState("");
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
  const incoming = useQuery({
    ...incomingOptions(folder, sourceRoot, page),
    enabled: Boolean(partId) && source !== "youtube",
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
      onComplete();
    },
  });
  return (
    <>
      <FieldGroup>
        <Field>
          <FieldLabel>مصدر الفيديوهات</FieldLabel>
          <Choice
            label="مصدر الاستيراد"
            value={source}
            onChange={(value) => {
              setSource(value);
              setSourceRoot("incoming");
              setFolder("");
              setPage(1);
              setMapping({});
              setReview(false);
            }}
            options={[
              { value: "server", label: "ملفات موجودة على الخادم" },
              { value: "upload", label: "رفع من هذا الجهاز" },
              { value: "youtube", label: "YouTube" },
            ]}
          />
        </Field>
        {source === "upload" && <UploadPanel />}
        <Field>
          <FieldLabel htmlFor="import-work-search">البحث عن عمل</FieldLabel>
          <Input
            id="import-work-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel>العمل</FieldLabel>
          <Choice
            label="العمل المراد استيراد فيديوهاته"
            value={workId}
            onChange={(id) => {
              setWorkId(id);
              setPartId("");
              setMapping({});
              setReview(false);
            }}
            options={[
              ...(works.data?.items ?? []).map((candidate) => ({
                value: candidate.id,
                label: candidate.titleAr ?? candidate.canonicalTitle,
              })),
              ...(work.data && !works.data?.items.some((candidate) => candidate.id === workId)
                ? [{ value: workId, label: work.data.titleAr ?? work.data.canonicalTitle }]
                : []),
            ]}
          />
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
            <Button variant="outline">إضافة جزء إلى العمل</Button>
          </CreateMediaPart>
        )}
        {part && source !== "youtube" && (
          <>
            {source === "server" && (
              <Field>
                <FieldLabel>موقع الملفات على الخادم</FieldLabel>
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
            <Field>
              <FieldLabel htmlFor="import-folder">المجلد</FieldLabel>
              <Input
                id="import-folder"
                value={folder}
                onChange={(event) => {
                  setFolder(event.target.value);
                  setPage(1);
                  setMapping({});
                  setReview(false);
                }}
                dir="ltr"
              />
              <FieldDescription>
                {sourceRoot === "library"
                  ? "تُعرض فيديوهات series وmovies غير المسجّلة فقط؛ اختر الجزء والحلقة قبل نقلها إلى التنظيم الدائم."
                  : "مسار نسبي داخل مجلد الملفات الواردة. ضع الفيديوهات المكتملة فيه أولًا."}
              </FieldDescription>
            </Field>
            <div className="flex flex-wrap gap-2">
              {folder && (
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
            {incoming.data?.files.length && (
              <Button
                variant="outline"
                onClick={() => {
                  const next: Record<string, string> = {};
                  for (const candidate of incoming.data?.files ?? []) {
                    const number = episodeNumber(candidate.relativePath);
                    if (number) {
                      const matches = part.episodes.filter(
                        (episode) => Number(episode.number) === number,
                      );
                      next[candidate.relativePath] = matches.length === 1 ? matches[0]!.id : "new";
                    }
                  }
                  setMapping(next);
                  setReview(false);
                }}
              >
                اقتراح الربط من أسماء الملفات
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
                        if (checked) next[file.relativePath] = "";
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
                          draftEpisodes[file.relativePath]?.title ?? episodeTitle(file.relativePath)
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
                  صفحة {page} من {Math.ceil(incoming.data.total / incoming.data.pageSize)}. اختيار
                  الملفات خاص بالصفحة الحالية.
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
              <FieldLabel htmlFor="import-copy">الاحتفاظ بالملفات الأصلية في موقعها</FieldLabel>
            </Field>
            <p>
              {selected.length} ملفًا محددًا.{" "}
              {copy ? "تبقى الملفات الأصلية." : "تُنقل الملفات بعد التحقق والتسجيل."} لا تُستبدل
              فيديوهات موجودة.
            </p>
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
      {source !== "youtube" && !(review && prepared?.review) && (
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
