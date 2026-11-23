import type { TrailerEntry } from "@nahhasio/api-contract";
import { cn } from "cn";
import { Info, Music2, Play } from "lucide-react";

import { Artwork } from "@/components/artwork";
import { useCardNavigation } from "@/components/card-navigation";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { workLink } from "@/features/shell/navigation";
import { languageName } from "@/lib/languages";

export type ClipSize = "small" | "medium" | "large";

const columns = {
  small: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6",
  medium: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
  large: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
} satisfies Record<ClipSize, string>;

export function clipGridColumns(size: ClipSize) {
  return columns[size];
}

function clipDetails({ work, trailer }: TrailerEntry) {
  const workTitle = work.titleAr || work.canonicalTitle;
  return {
    workTitle,
    title: trailer.title || workTitle,
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.youtubeVideoId)}`,
    language: trailer.language ? languageName(trailer.language) : null,
  };
}

export function ClipGrid({ items, size }: { items: TrailerEntry[]; size: ClipSize }) {
  return (
    <ul aria-label="قائمة المقاطع" className={cn("grid gap-x-4 gap-y-6", columns[size])}>
      {items.map((entry) => (
        <ClipCard key={entry.trailer.id} entry={entry} />
      ))}
    </ul>
  );
}

function ClipCard({ entry }: { entry: TrailerEntry }) {
  const navigation = useCardNavigation();
  const { workTitle, title, url, language } = clipDetails(entry);
  const { work } = entry;
  return (
    <li className="flex min-w-0 flex-col gap-1">
      <a
        {...navigation}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`تشغيل ${title} على YouTube`}
        className="group/clip flex min-w-0 flex-col gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="relative isolate block aspect-square overflow-hidden rounded-xl border border-border bg-secondary">
          <Artwork
            id={work.banner?.id ?? work.poster?.id}
            alt=""
            width={640}
            className="absolute inset-0 size-full object-cover motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover/clip:scale-105"
            fallback={<Music2 className="size-7" aria-hidden />}
          />
          <span
            className="absolute end-2 bottom-2 grid size-9 place-items-center rounded-full bg-player-chrome/85 text-primary-foreground shadow-sm motion-safe:transition-transform motion-safe:group-hover/clip:scale-110 motion-safe:group-focus-visible/clip:scale-110"
            aria-hidden
          >
            <Play className="size-4" />
          </span>
        </span>
        <span
          className="line-clamp-2 px-0.5 text-sm leading-snug font-semibold sm:text-base"
          dir="auto"
        >
          {title}
        </span>
      </a>
      {(workTitle !== title || language) && (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-0.5 text-xs text-muted-foreground">
          {workTitle !== title && (
            <a
              className="min-w-0 truncate rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              href={workLink(work.id)}
              aria-label={`تفاصيل ${workTitle}`}
              dir="auto"
            >
              {workTitle}
            </a>
          )}
          {language && <span className="shrink-0">{language}</span>}
        </div>
      )}
      {workTitle === title && (
        <a
          className="self-start rounded-sm px-0.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          href={workLink(work.id)}
          aria-label={`تفاصيل ${workTitle}`}
        >
          تفاصيل العمل
        </a>
      )}
    </li>
  );
}

export function ClipTable({ items, size }: { items: TrailerEntry[]; size: ClipSize }) {
  return (
    <Table aria-label="جدول المقاطع" className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>المقطع</TableHead>
          <TableHead className="hidden sm:table-cell">العمل</TableHead>
          <TableHead className="hidden w-24 md:table-cell">اللغة</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">التفاصيل</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((entry) => (
          <ClipRow key={entry.trailer.id} entry={entry} size={size} />
        ))}
      </TableBody>
    </Table>
  );
}

function ClipRow({ entry, size }: { entry: TrailerEntry; size: ClipSize }) {
  const navigation = useCardNavigation();
  const { workTitle, title, url, language } = clipDetails(entry);
  const { work } = entry;
  return (
    <TableRow>
      <TableCell className="px-1 py-2 sm:px-3">
        <a
          {...navigation}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`تشغيل ${title} على YouTube`}
          className="flex min-w-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-3"
        >
          <Artwork
            id={work.banner?.id ?? work.poster?.id}
            alt=""
            width={320}
            className={cn(
              "aspect-video shrink-0 rounded-md object-cover",
              size === "small" ? "w-12" : size === "large" ? "w-20" : "w-16",
            )}
            fallback={<Play className="size-4" aria-hidden />}
          />
          <span className="min-w-0">
            <span className="block truncate font-medium" dir="auto">
              {title}
            </span>
            <span className="block truncate text-xs text-muted-foreground sm:hidden" dir="auto">
              {workTitle}
            </span>
          </span>
        </a>
      </TableCell>
      <TableCell className="hidden truncate sm:table-cell" dir="auto">
        {workTitle}
      </TableCell>
      <TableCell className="hidden md:table-cell">{language ?? "—"}</TableCell>
      <TableCell className="px-1 py-2">
        <a
          href={workLink(work.id)}
          aria-label={`تفاصيل ${workTitle}`}
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <Info />
        </a>
      </TableCell>
    </TableRow>
  );
}
