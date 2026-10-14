import { useQuery } from "@tanstack/react-query";
import { CopyIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { databaseSchemaOptions } from "@/features/database/data/database.queries";
import type { WorkField } from "@/features/editor/json/document/document-model";
import type { StructureScope } from "@/features/editor/json/tree/json-projection";
import {
  selectedEnumReferences,
  selectedVocabularyReferences,
} from "@/features/editor/json/tree/json-reference-model";
import { getJsonVocabulary } from "@/features/editor/json/tree/json-reference.functions";

export function JsonEnumReference({
  fields,
  scope,
}: {
  fields: WorkField[];
  scope: StructureScope;
}) {
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const schema = useQuery(databaseSchemaOptions());
  const vocabularyBindings = selectedVocabularyReferences(fields);
  const tables = vocabularyBindings.map((binding) => binding.table);
  const vocabularies = useQuery({
    queryKey: ["database", "json-vocabulary-reference", tables],
    queryFn: ({ signal }) => getJsonVocabulary({ data: { tables }, signal }),
    enabled: tables.length > 0,
    staleTime: 60_000,
  });
  const enums = selectedEnumReferences(schema.data ?? [], fields, scope);
  const options = vocabularyBindings.map((binding) => ({
    ...binding,
    options: vocabularies.data?.find((entry) => entry.table === binding.table)?.options ?? [],
  }));
  const reference = {
    fields,
    enums: Object.fromEntries(
      enums.map((entry) => [entry.path, entry.nullable ? [...entry.values, null] : entry.values]),
    ),
    options: Object.fromEntries(
      options.map((entry) => [entry.path, entry.options.map((option) => option.value)]),
    ),
  };
  const term = search.trim().toLowerCase();
  const matches = (values: string[]) => values.join(" ").toLowerCase().includes(term);
  const visibleEnums = enums.filter((entry) => matches([entry.path, entry.label, ...entry.values]));
  const visibleOptions = options.filter((entry) =>
    matches([
      entry.path,
      entry.label,
      ...entry.options.flatMap((option) => [option.value, option.label]),
    ]),
  );
  const pending = schema.isPending || (tables.length > 0 && vocabularies.isPending);
  const error = schema.error ?? (tables.length > 0 ? vocabularies.error : null);
  function copy(value: string, label: string) {
    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopyError(false);
        setNotice(`نُسخ ${label}`);
        return true;
      })
      .catch(() => {
        setCopyError(true);
        setNotice("تعذّر النسخ إلى الحافظة.");
      });
  }
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>مرجع القيم</CardTitle>
        <CardDescription>
          القيم المتاحة للحقول المختارة فقط. اضغط قيمة لنسخها، أو انسخ المرجع كاملاً.
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || !!error}
            onClick={() => copy(JSON.stringify(reference, null, 2), "مرجع الحقول المختارة")}
          >
            <CopyIcon data-icon="inline-start" />
            نسخ المرجع
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="البحث في مرجع القيم"
              placeholder="ابحث عن حقل أو قيمة…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </InputGroup>
          {pending && <Skeleton className="h-24" />}
          {error && (
            <Alert variant="destructive" className="border-border">
              <AlertTitle>تعذّر تحميل المرجع</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void schema.refetch();
                  if (tables.length) void vocabularies.refetch();
                }}
              >
                إعادة المحاولة
              </Button>
            </Alert>
          )}
          <Tabs defaultValue="enums">
            <TabsList variant="line">
              <TabsTrigger value="enums">Enums · {enums.length}</TabsTrigger>
              <TabsTrigger value="options">خيارات الفهرسة · {options.length}</TabsTrigger>
            </TabsList>
            <TabsContent value="enums">
              <div className="grid gap-3 sm:grid-cols-2">
                {visibleEnums.map((entry) => (
                  <Card key={entry.path} size="sm" className="min-w-0">
                    <CardHeader>
                      <CardTitle>{entry.label}</CardTitle>
                      <CardDescription>
                        <code dir="ltr" className="break-all">
                          {entry.path}
                        </code>
                      </CardDescription>
                      <CardAction>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`نسخ خيارات ${entry.label}`}
                          onClick={() =>
                            copy(
                              JSON.stringify(
                                { [entry.path]: reference.enums[entry.path] },
                                null,
                                2,
                              ),
                              entry.label,
                            )
                          }
                        >
                          <CopyIcon />
                        </Button>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.values.map((value) => (
                          <Button
                            key={value}
                            variant="outline"
                            size="sm"
                            onClick={() => copy(JSON.stringify(value), value)}
                          >
                            <code dir="ltr">{value}</code>
                          </Button>
                        ))}
                        {entry.nullable && (
                          <Button variant="outline" size="sm" onClick={() => copy("null", "null")}>
                            <code>null</code>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <code dir="ltr" className="break-all text-xs text-muted-foreground">
                        {entry.databaseColumn}
                      </code>
                    </CardFooter>
                  </Card>
                ))}
              </div>
              {!pending && !visibleEnums.length && (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>لا توجد قيم محددة</EmptyTitle>
                    <EmptyDescription>حدد حقولاً لها enum أو غيّر البحث.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </TabsContent>
            <TabsContent value="options">
              <div className="flex flex-col gap-3">
                {visibleOptions.map((entry) => (
                  <Card key={entry.path} size="sm" className="min-w-0">
                    <CardHeader>
                      <CardTitle>{entry.label}</CardTitle>
                      <CardDescription>
                        <code dir="ltr" className="break-all">
                          {entry.path}
                        </code>{" "}
                        · {entry.options.length} خيار
                      </CardDescription>
                      <CardAction>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`نسخ خيارات ${entry.label}`}
                          onClick={() =>
                            copy(
                              JSON.stringify(
                                { [entry.path]: entry.options.map((option) => option.value) },
                                null,
                                2,
                              ),
                              entry.label,
                            )
                          }
                        >
                          <CopyIcon />
                        </Button>
                      </CardAction>
                    </CardHeader>
                    <CardContent>
                      <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
                        {entry.options
                          .filter(
                            (option) =>
                              !term ||
                              matches([entry.label, entry.path, option.value, option.label]),
                          )
                          .map((option) => (
                            <Button
                              key={option.value}
                              variant="outline"
                              size="sm"
                              title={option.label}
                              onClick={() => copy(JSON.stringify(option.value), option.label)}
                            >
                              <span>{option.label}</span>
                              <code dir="ltr">{option.value}</code>
                            </Button>
                          ))}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Badge variant="secondary">{entry.table}</Badge>
                    </CardFooter>
                  </Card>
                ))}
              </div>
              {!pending && !visibleOptions.length && (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>لا توجد خيارات فهرسة مختارة</EmptyTitle>
                    <EmptyDescription>
                      حدد الكواكب أو التصنيفات أو حقول الفهرسة لإظهار خياراتها.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
      <CardFooter>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {notice ?? `${enums.length} حقلاً بقيم محددة · ${options.length} قوائم خيارات`}
        </span>
        {copyError && <Badge variant="destructive">تعذّر النسخ</Badge>}
      </CardFooter>
    </Card>
  );
}
