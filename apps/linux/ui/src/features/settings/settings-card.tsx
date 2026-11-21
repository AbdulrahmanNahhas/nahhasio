import type { ReactNode } from "react";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

export function SettingsCard({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">{children}</CardContent>
      {footer && <CardFooter className="border-t">{footer}</CardFooter>}
    </Card>
  );
}
