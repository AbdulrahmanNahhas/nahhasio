import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function HomeSectionHeading({
  title,
  description,
  href,
  linkLabel = "عرض الكل",
  children,
}: {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {href && (
          <a href={href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {linkLabel}
            <ArrowLeft data-icon="inline-end" />
          </a>
        )}
      </div>
    </header>
  );
}

/** Mount each lower discovery section once, shortly before it enters the scroll viewport. */
export function DeferredHomeSection({ children }: { children: ReactNode }) {
  const target = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!target.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "500px" },
    );
    observer.observe(target.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={target} className="min-w-0">
      {near ? (
        children
      ) : (
        <div className="flex min-h-80 flex-col gap-4" aria-hidden="true">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}
    </div>
  );
}
