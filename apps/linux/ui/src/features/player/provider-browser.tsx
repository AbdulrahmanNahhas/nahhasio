import { Captions, Play, Search, Star, Upload } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";

import {
  offerKey,
  type EmbedStatus,
  type ProviderOffer,
  type ProviderCapabilities,
} from "./stream-providers";

function known(value?: ProviderCapabilities["subtitles"]) {
  return value === "reported" || value === "documented";
}
function Features({ offer }: { offer: ProviderOffer }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {offer.preferred && (
        <Badge variant="secondary">
          <Star data-icon="inline-start" />
          DUB + عربي
        </Badge>
      )}
      {!offer.preferred && offer.audio !== "original" && (
        <Badge variant="outline">{offer.audio === "dub" ? "DUB" : "SUB"}</Badge>
      )}
      {known(offer.capabilities?.arabic) ? (
        <Badge variant="outline">
          <Captions data-icon="inline-start" />
          عربي
        </Badge>
      ) : (
        known(offer.capabilities?.subtitles) && (
          <Badge variant="outline">
            <Captions data-icon="inline-start" />
            ترجمة
          </Badge>
        )
      )}
      {known(offer.capabilities?.upload) && (
        <Badge variant="outline">
          <Upload data-icon="inline-start" />
          إضافة ترجمة
        </Badge>
      )}
    </div>
  );
}

export function ProviderBrowser({
  offers,
  anime,
  busy,
  status,
  onOpen,
  onPresent,
}: {
  offers: ProviderOffer[];
  anime: boolean;
  busy: boolean;
  status?: EmbedStatus;
  onOpen: (offer: ProviderOffer) => void;
  onPresent: () => void;
}) {
  const [search, setSearch] = useState("");
  const [openingKey, setOpeningKey] = useState("");
  const [problems, setProblems] = useState(false);
  const term = search.trim().toLocaleLowerCase();
  const filtered = offers
    .filter((offer) => offer.name.toLocaleLowerCase().includes(term))
    .toSorted((a, b) => Number(b.preferred) - Number(a.preferred));
  const primary = (offer: ProviderOffer) =>
    offer.preferred || (offer.tier !== "issues" && (!anime || offer.audio === "dub"));
  const regular = filtered.filter(primary);
  const additional = filtered.filter((offer) => !primary(offer));
  const expanded = problems || Boolean(term);
  const visible = expanded ? [...regular, ...additional] : regular;
  function rows(items: ProviderOffer[]) {
    return items.map((offer) => {
      const key = offerKey(offer);
      const active =
        status?.phase !== "closed" &&
        status?.provider === offer.provider &&
        status?.audio === offer.audio;
      const present = active && status?.phase !== "failed";
      return (
        <div key={key} role="listitem" data-provider-choice={key}>
          <Item
            variant={present ? "muted" : "outline"}
            className="h-full text-start"
            render={
              <button
                type="button"
                disabled={busy || !offer.available}
                aria-label={
                  present
                    ? "إظهار المشغّل"
                    : `المشاهدة عبر ${offer.name}${offer.audio === "sub" ? " SUB" : ""}`
                }
                aria-busy={busy && openingKey === key}
                title={!offer.available ? (offer.reason ?? "غير متاح") : undefined}
                onClick={() => {
                  setOpeningKey(key);
                  if (present) onPresent();
                  else onOpen(offer);
                }}
              />
            }
          >
            <ItemContent className="min-w-0 gap-2">
              <ItemTitle>
                <span dir="ltr">{offer.name}</span>
              </ItemTitle>
              <Features offer={offer} />
              {active && (
                <span role="status" className="text-xs text-muted-foreground">
                  {status?.phase === "loading"
                    ? "جارٍ فتح المشغّل…"
                    : status?.phase === "failed"
                      ? "تعذّر فتح المشغّل"
                      : "المشغّل مفتوح"}
                </span>
              )}
              {!offer.available && offer.reason && (
                <ItemDescription>{offer.reason}</ItemDescription>
              )}
            </ItemContent>
            <ItemActions>
              {busy && openingKey === key ? (
                <Spinner />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
            </ItemActions>
          </Item>
        </div>
      );
    });
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-3">
        <InputGroup className="min-w-0 flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="البحث عن مزوّد"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث عن خادم…"
          />
        </InputGroup>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Set(filtered.map((offer) => offer.provider)).size} خادم
        </span>
      </div>
      <ItemGroup aria-label="مزوّد الفيديو" className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {rows(regular)}
        {expanded && rows(additional)}
      </ItemGroup>
      {additional.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          aria-expanded={expanded}
          onClick={() => setProblems(!problems)}
        >
          {problems ? "إخفاء الخيارات الإضافية" : "خيارات إضافية"} ({additional.length})
        </Button>
      )}
      {!visible.length && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد خوادم مطابقة</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
