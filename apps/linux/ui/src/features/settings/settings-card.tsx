import type { ReactNode } from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export function SettingsCard({
  title,
  description,
  children,
  footer,
  horizontal = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  horizontal?: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent
        className={
          horizontal
            ? "flex flex-wrap items-center justify-between gap-4"
            : "flex flex-col items-start gap-4"
        }
      >
        {children}
      </CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
