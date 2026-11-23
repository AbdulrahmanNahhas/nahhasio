import { cn } from "cn";
import { Search, X } from "lucide-react";
import { useRef, type HTMLAttributes, type ReactNode, type RefObject } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

type PublicPageProps = HTMLAttributes<HTMLElement> & { as?: "section" | "article" | "div" };

/** Shared page rhythm; artwork heroes and work details keep their own compositions. */
export function PublicPage({ as: Element = "section", className, ...props }: PublicPageProps) {
  return (
    <Element
      className={cn(
        "mx-auto w-full min-w-0 max-w-400 px-4 py-6 sm:px-8 sm:py-8 lg:px-10",
        className,
      )}
      {...props}
    />
  );
}

export function CatalogPage({
  heading,
  toolbar,
  children,
  ...props
}: PublicPageProps & { heading: ReactNode; toolbar?: ReactNode }) {
  return (
    <PublicPage {...props} className="flex flex-col gap-5">
      <div className="@container flex min-w-0 flex-col gap-4">
        {heading}
        {toolbar}
      </div>
      <div className="min-w-0">{children}</div>
    </PublicPage>
  );
}
export function PublicPageHeader({
  title,
  description,
  actions,
  count,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  count?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl leading-relaxed font-semibold sm:text-3xl">
            {title}
          </h1>
          {count}
        </div>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions}
    </header>
  );
}

export function PublicPageSearch({
  label,
  placeholder,
  value,
  onChange,
  maxLength,
  inputRef,
  clearLabel = "مسح البحث",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  inputRef?: RefObject<HTMLInputElement | null>;
  clearLabel?: string;
}) {
  const localInput = useRef<HTMLInputElement>(null);
  const input = inputRef ?? localInput;
  return (
    <InputGroup className="h-11 w-full sm:min-w-56 sm:max-w-md sm:flex-1">
      <InputGroupAddon>
        <Search aria-hidden />
      </InputGroupAddon>
      <InputGroupInput
        ref={input}
        aria-label={label}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            size="icon-sm"
            aria-label={clearLabel}
            onClick={() => {
              onChange("");
              input.current?.focus();
            }}
          >
            <X aria-hidden />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
