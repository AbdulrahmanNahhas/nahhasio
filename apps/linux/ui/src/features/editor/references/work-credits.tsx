import type { WorkDocument } from "@arcadia/contracts/work";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, Building, User, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ContributionLanguages } from "@/features/admin/entities/contribution-languages";
import { RegisteredImage } from "@/features/editor/registered-image";
import { withPositions } from "@/features/editor/structure/ordered-rows";
import { useEditorRows } from "@/features/editor/structure/use-editor-rows";

import { findReferences, referenceValueFilter, vocabularyOptions } from "./reference.functions";
import { WorkCreditEditor } from "./work-credit-editor";

type Credit = NonNullable<WorkDocument["credits"]>[number];
type Kind = "person" | "organization" | null;
const groups = [
  { kind: "person", label: "الأشخاص" },
  { kind: "organization", label: "الاستوديوهات والجهات" },
  { kind: null, label: "مراجع تحتاج مراجعة" },
] as const;
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}|ـ/gu, "")
    .toLowerCase()
    .trim();

export function WorkCredits({
  credits,
  onChange,
}: {
  credits: Credit[];
  onChange: (credits: Credit[]) => void;
}) {
  const vocabulary = useQuery(vocabularyOptions());
  const roleLabels = vocabulary.data?.find((item) => item.table === "roles")?.options;
  const rows = useEditorRows(credits);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{ key: string; credit: Credit | null; kind: Kind } | null>(
    null,
  );
  const roleNames = [...new Set(credits.map((credit) => credit.role))];
  const roles = useQueries({
    queries: roleNames.map((slug) => ({
      queryKey: ["database", "credit-role", slug],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        findReferences({
          data: { table: "roles", search: "", filters: { slug } },
          signal,
        }),
      enabled: Boolean(slug),
      staleTime: 60000,
    })),
  });
  const rolesByName = new Map(roleNames.map((slug, index) => [slug, roles[index]]));
  const entityRequests = credits.map((credit) => {
    const kind = rolesByName.get(credit.role)?.data?.[0]?.entityKind;
    const reference = referenceValueFilter("entities", credit.entity);
    const filters = kind ? { ...reference, kind } : reference;
    return { key: JSON.stringify(filters), filters, enabled: Boolean(credit.entity) };
  });
  const uniqueRequests = [
    ...new Map(entityRequests.map((request) => [request.key, request])).values(),
  ];
  const entities = useQueries({
    queries: uniqueRequests.map((request) => ({
      queryKey: ["database", "credit-entity", request.filters],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        findReferences({
          data: { table: "entities", search: "", filters: request.filters },
          signal,
        }),
      enabled: request.enabled,
      staleTime: 60000,
    })),
  });
  const entitiesByKey = new Map(
    uniqueRequests.map((request, index) => [request.key, entities[index]]),
  );
  const entries = rows.map((row, index) => {
    const roleQuery = rolesByName.get(row.value.role);
    const entityQuery = entitiesByKey.get(entityRequests[index]?.key ?? "");
    const role = roleQuery?.data?.[0];
    const entity = entityQuery?.data?.find(
      (option) => option.id === row.value.entity || option.value === row.value.entity,
    );
    const kind = entity?.entityKind ?? role?.entityKind ?? null;
    return {
      ...row,
      index,
      entity,
      role,
      kind,
      resolving: roleQuery?.isFetching || entityQuery?.isFetching,
      label: entity?.label ?? row.value.entity,
    };
  });
  const hasError = roles.some((query) => query.isError) || entities.some((query) => query.isError);
  function apply(credit: Credit) {
    const index = entries.findIndex((entry) => entry.key === editor?.key);
    const duplicate = entries.some(
      (entry, i) =>
        i !== index &&
        entry.value.role === credit.role &&
        (entry.value.entity === credit.entity || entry.entity?.id === credit.entity),
    );
    if (duplicate) return "هذا المساهم والدور موجودان بالفعل.";
    if (editor?.credit && index < 0) return "تغيّرت المساهمة؛ أغلق المحرر وأعد فتحها.";
    onChange(
      index < 0
        ? [
            ...credits,
            { ...credit, position: Math.max(-1, ...credits.map((item) => item.position ?? 0)) + 1 },
          ]
        : credits.map((item, i) => (i === index ? credit : item)),
    );
    setEditor(null);
    return null;
  }
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label="المساهمون والاستوديوهات">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">
          المساهمون والاستوديوهات <Badge variant="secondary">{credits.length}</Badge>
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditor({ key: "new", credit: null, kind: "person" })}
        >
          <Plus data-icon="inline-start" />
          إضافة مساهمة
        </Button>
      </div>
      {!!credits.length && (
        <InputGroup>
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="البحث في المساهمين"
            placeholder="ابحث بالاسم أو الدور…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </InputGroup>
      )}
      {hasError && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل بعض المراجع</AlertTitle>
          <AlertDescription>
            تبقى المساهمات محفوظة في المسودة. أعد المحاولة لعرض الأسماء والصور.
          </AlertDescription>
          <Button
            variant="outline"
            onClick={() => {
              for (const query of [...roles, ...entities]) if (query.isError) void query.refetch();
            }}
          >
            إعادة المحاولة
          </Button>
        </Alert>
      )}
      {!credits.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>أضف صنّاع العمل وجهاته</EmptyTitle>
            <EmptyDescription>اختر شخصاً أو استوديو وحدّد دوره في العمل.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {groups.map((group) => {
        const all = entries.filter((entry) => entry.kind === group.kind);
        const visible = all.filter((entry) =>
          normalize(
            [
              entry.label,
              entry.value.entity,
              entry.role?.label,
              entry.role?.value,
              entry.value.role,
            ].join(" "),
          ).includes(normalize(search)),
        );
        if (!all.length || !visible.length) return null;
        return (
          <section
            key={group.label}
            className="flex min-w-0 flex-col gap-2"
            aria-label={group.label}
          >
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                {group.kind === null && all.some((entry) => entry.resolving)
                  ? "جارٍ تحميل المراجع…"
                  : group.label}
              </h4>
              <Badge variant="outline">
                {visible.length}
                {search ? ` / ${all.length}` : ""}
              </Badge>
            </div>
            {visible.map((entry) => {
              const groupIndex = all.findIndex((item) => item.key === entry.key);
              function move(direction: -1 | 1) {
                const target = all[groupIndex + direction];
                if (!target) return;
                const next = [...credits];
                [next[entry.index], next[target.index]] = [next[target.index], next[entry.index]];
                onChange(withPositions(next));
              }
              return (
                <div key={entry.key} className="flex min-w-0 items-center gap-2">
                  <div
                    className="flex shrink-0 flex-col"
                    role="group"
                    aria-label={`ترتيب ${entry.label}`}
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`رفع ${entry.label}`}
                      disabled={groupIndex === 0}
                      onClick={() => move(-1)}
                    >
                      <ArrowUp data-icon="inline-start" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`خفض ${entry.label}`}
                      disabled={groupIndex === all.length - 1}
                      onClick={() => move(1)}
                    >
                      <ArrowDown data-icon="inline-start" />
                    </Button>
                  </div>
                  <article
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-nowrap"
                    aria-label={`مساهمة ${entry.label}`}
                  >
                    <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
                      {entry.entity?.image ? (
                        <RegisteredImage
                          src={entry.entity.image}
                          alt=""
                          className="size-full"
                          fit={entry.kind === "organization" ? "contain" : "cover"}
                        />
                      ) : entry.kind === "organization" ? (
                        <Building className="size-6 text-muted-foreground" />
                      ) : (
                        <User className="size-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-medium" dir="auto">
                        {!entry.entity && entry.resolving ? (
                          <Skeleton className="h-5 w-32" />
                        ) : (
                          entry.label || "مساهم غير محدد"
                        )}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {entry.role?.label ??
                            roleLabels?.find((role) => role.value === entry.value.role)?.label ??
                            (entry.resolving ? (
                              <Skeleton className="h-4 w-16" />
                            ) : (
                              entry.value.role
                            ))}
                        </Badge>
                        {entry.value.isPrimary && <Badge variant="secondary">رئيسي</Badge>}
                      </div>
                    </div>
                    <div className="flex max-w-full flex-wrap items-center gap-1">
                      <ContributionLanguages
                        title={entry.label}
                        values={entry.value.languages ?? []}
                        disabled={Boolean(entry.resolving)}
                        onChange={(languages) =>
                          onChange(
                            credits.map((credit, i) =>
                              i === entry.index ? { ...credit, languages } : credit,
                            ),
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`تحرير مساهمة ${entry.label}`}
                        onClick={() =>
                          setEditor({
                            key: entry.key,
                            credit: {
                              ...entry.value,
                              entity: entry.entity?.id ?? entry.value.entity,
                            },
                            kind: entry.kind,
                          })
                        }
                      >
                        <Pencil data-icon="inline-start" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`إزالة مساهمة ${entry.label}`}
                        onClick={() =>
                          onChange(withPositions(credits.filter((_, i) => i !== entry.index)))
                        }
                      >
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    </div>
                  </article>
                </div>
              );
            })}
          </section>
        );
      })}
      {!!credits.length &&
        !entries.some((entry) =>
          normalize(
            [
              entry.label,
              entry.value.entity,
              entry.role?.label,
              entry.role?.value,
              entry.value.role,
            ].join(" "),
          ).includes(normalize(search)),
        ) && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>لا توجد مساهمات مطابقة</EmptyTitle>
              <EmptyDescription>جرّب اسماً أو دوراً آخر.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      <Dialog
        open={Boolean(editor)}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      >
        {editor && (
          <WorkCreditEditor
            key={editor.key}
            initial={editor.credit}
            initialKind={editor.kind}
            onSave={apply}
            onClose={() => setEditor(null)}
          />
        )}
      </Dialog>
    </section>
  );
}
