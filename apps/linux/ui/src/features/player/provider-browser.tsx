import { Captions, ChevronDown, MonitorPlay } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { offerKey, type ProviderOffer } from "./stream-providers";

function audioLabel(offer: ProviderOffer) {
  return offer.audio === "dub" ? "دبلجة" : offer.audio === "sub" ? "ترجمة" : null;
}

export function ProviderMenu({
  offers,
  selected,
  onSelect,
  disabled,
  children,
  anime,
}: {
  offers: ProviderOffer[];
  selected?: ProviderOffer;
  onSelect: (offer: ProviderOffer) => void;
  disabled?: boolean;
  children?: ReactNode;
  anime?: boolean;
}) {
  const alternatives = anime
    ? offers.filter((offer) => offer.audio === "sub" || offer.provider === "vidzee")
    : [];
  const primary = offers.filter((offer) => !alternatives.includes(offer));
  function choices(items: ProviderOffer[]) {
    return (
      <DropdownMenuRadioGroup
        value={selected ? offerKey(selected) : ""}
        onValueChange={(key) => {
          const offer = items.find((item) => offerKey(item) === key);
          if (offer?.available) onSelect(offer);
        }}
      >
        {items.map((offer) => (
          <DropdownMenuRadioItem
            key={offerKey(offer)}
            value={offerKey(offer)}
            disabled={!offer.available}
            closeOnClick
          >
            <bdi>{offer.name}</bdi>
            <span className="ms-auto text-xs text-muted-foreground">
              {offer.available
                ? anime && (offer.preferred ? "DUB + عربي" : audioLabel(offer))
                : offer.reason}
            </span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label="مصدر الفيديو"
            disabled={disabled || (!offers.length && !children)}
          />
        }
      >
        <MonitorPlay data-icon="inline-start" />
        {selected ? <bdi>{selected.name}</bdi> : "مصدر الفيديو"}
        {anime && selected && audioLabel(selected) && (
          <span className="text-muted-foreground">{audioLabel(selected)}</span>
        )}
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="min-w-56">
        {primary.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel>خوادم الفيديو</DropdownMenuLabel>
            {choices(primary)}
          </DropdownMenuGroup>
        )}
        {alternatives.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Captions data-icon="inline-start" />
              مصادر مترجمة
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>{choices(alternatives)}</DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {children && (
          <>
            {offers.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>{children}</DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
