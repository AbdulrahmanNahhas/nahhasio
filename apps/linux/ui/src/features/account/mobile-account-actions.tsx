import { HardDrive, LogOut, Server, Users } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { ServerConnections } from "../auth/server-connections";
import { useAccountActions } from "./use-account-actions";

export function MobileAccountActions({
  accountId,
  close,
}: {
  accountId: string;
  close: () => void;
}) {
  const { local, switching, logout } = useAccountActions(accountId);
  const [connections, setConnections] = useState(false);
  const busy = local.isPending || switching.isPending || logout.isPending;
  const error = switching.error ?? logout.error;
  return (
    <section className="flex flex-col gap-2" aria-label="إجراءات الحساب">
      <h2 className="text-sm text-muted-foreground">الحساب والاتصال</h2>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-auto min-h-11 whitespace-normal"
          disabled={busy}
          onClick={() => switching.mutate()}
        >
          <Users data-icon="inline-start" />
          تبديل الحساب
        </Button>
        <Button
          variant="outline"
          className="h-auto min-h-11 whitespace-normal"
          disabled={busy}
          onClick={() => setConnections(true)}
        >
          <Server data-icon="inline-start" />
          الخادم والاتصال
        </Button>
        <Button
          variant="outline"
          className="h-auto min-h-11 whitespace-normal"
          disabled={busy}
          onClick={() => local.mutate(undefined, { onSuccess: close })}
        >
          <HardDrive data-icon="inline-start" />
          المكتبة دون اتصال
        </Button>
        <Button
          variant="destructive"
          className="h-auto min-h-11 whitespace-normal"
          disabled={busy}
          onClick={() => logout.mutate()}
        >
          <LogOut data-icon="inline-start" />
          {logout.isPending ? "جارٍ الخروج…" : "تسجيل الخروج"}
        </Button>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      <ServerConnections open={connections} onOpenChange={setConnections} />
    </section>
  );
}
