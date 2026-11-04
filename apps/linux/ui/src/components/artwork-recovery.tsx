import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import { artworkImageFailures } from "../lib/artwork-image-failures";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";

export function ArtworkRecovery() {
  const cache = useQueryClient().getQueryCache();
  const subscribe = useCallback((notify: () => void) => cache.subscribe(notify), [cache]);
  const count = useSyncExternalStore(
    subscribe,
    () =>
      cache.findAll({
        queryKey: ["artwork"],
        type: "active",
        predicate: (query) => query.state.status === "error",
      }).length,
  );
  const imageFailures = useSyncExternalStore(
    artworkImageFailures.subscribe,
    artworkImageFailures.count,
  );
  const total = count + imageFailures;
  if (!total) return null;
  return (
    <Alert role="status" className="shrink-0">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        <span>تعذّر تحميل بعض الصور ({total}). يمكنك إعادة المحاولة دون تحديث الصفحة.</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.dispatchEvent(new Event("nahhasio:retry-artwork"))}
        >
          إعادة تحميل الصور
        </Button>
      </AlertDescription>
    </Alert>
  );
}
