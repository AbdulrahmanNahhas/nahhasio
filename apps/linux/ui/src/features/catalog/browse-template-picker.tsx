import { Check, LayoutTemplate } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { groupChoices, sortChoices } from "./browse-refinements";
import { browseTemplates, templateSettings } from "./browse-templates";
import type { DisplayPreferences } from "./display-preferences";
import { parseFilters } from "./filter-model";

export function BrowseTemplatePicker({
  search,
  display,
  onApply,
}: {
  search: string;
  display: DisplayPreferences;
  onApply: (search: string, display: DisplayPreferences) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = new URLSearchParams(search);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <LayoutTemplate data-icon="inline-start" /> عروض التصفح
      </DialogTrigger>
      <DialogContent className="max-h-5/6 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>كيف تريد تصفّح المكتبة؟</DialogTitle>
          <DialogDescription>
            عروض جاهزة تضبط المرشحات والترتيب والتجميع وطريقة العرض بنقرة واحدة.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-6">
          {(
            [
              { key: "watch", label: "للمشاهدة" },
              { key: "explore", label: "استكشاف المكتبة" },
            ] as const
          ).map((section) => (
            <section
              key={section.key}
              className="flex flex-col gap-3"
              aria-labelledby={`templates-${section.key}`}
            >
              <h3 id={`templates-${section.key}`} className="text-sm font-semibold">
                {section.label}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {browseTemplates
                  .filter((template) => template.section === section.key)
                  .map((template) => {
                    const next = templateSettings(template, current.get("privacy"));
                    const params = new URLSearchParams(next.search);
                    const active =
                      !current.get("q") &&
                      !current.get("from") &&
                      !current.get("to") &&
                      (current.get("view") ?? "works") === "works" &&
                      (current.get("sort") ?? "year-desc") === template.sort &&
                      (current.get("group") ?? "none") === (template.group ?? "none") &&
                      JSON.stringify(parseFilters(current.get("filters"))) ===
                        JSON.stringify(parseFilters(params.get("filters"))) &&
                      JSON.stringify(display) === JSON.stringify(next.display);
                    return (
                      <Button
                        key={template.id}
                        variant={active ? "secondary" : "outline"}
                        className="h-auto min-w-0 items-start justify-start gap-3 px-4 py-4"
                        aria-pressed={active}
                        onClick={() => {
                          onApply(next.search, next.display);
                          setOpen(false);
                        }}
                      >
                        <template.icon data-icon="inline-start" />
                        <span className="flex min-w-0 flex-1 flex-col gap-2 text-start whitespace-normal">
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{template.title}</span>
                            {active && <Check className="size-4" aria-label="العرض الحالي" />}
                          </span>
                          <span className="text-sm font-normal text-muted-foreground">
                            {template.description}
                          </span>
                          <span className="flex flex-wrap gap-1.5">
                            <Badge variant="outline">
                              {sortChoices.find((sort) => sort.value === template.sort)?.label}
                            </Badge>
                            {template.group && (
                              <Badge variant="outline">
                                حسب{" "}
                                {
                                  groupChoices.find((group) => group.value === template.group)
                                    ?.label
                                }
                              </Badge>
                            )}
                            <Badge variant="secondary">
                              {
                                {
                                  poster: "ملصقات",
                                  banner: "لافتات",
                                  logo: "شعارات",
                                  table: "جدول",
                                }[next.display.layout]
                              }
                            </Badge>
                          </span>
                        </span>
                      </Button>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          يُستبدل البحث والمرشحات الحالية. يبقى نطاق الخصوصية والكوكب الحالي كما هو. تعريفات العروض
          ثابتة وتُدار ضمن التطبيق.
        </p>
      </DialogContent>
    </Dialog>
  );
}
