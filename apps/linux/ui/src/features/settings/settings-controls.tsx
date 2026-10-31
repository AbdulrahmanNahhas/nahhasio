import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";

export function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card size="sm" data-upcoming="true" aria-label={title}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function SettingsRow({
  id,
  label,
  description,
  compact,
  disabled,
  children,
}: {
  id: string;
  label: string;
  description: string;
  compact?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Field
      orientation={compact ? "horizontal" : "responsive"}
      data-disabled={disabled || undefined}
      className="min-w-0 py-4"
    >
      <FieldContent className="min-w-0">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription id={`${id}-description`}>{description}</FieldDescription>
      </FieldContent>
      {compact ? (
        children
      ) : (
        <div className="min-w-0 @md/field-group:w-64 @md/field-group:shrink-0">{children}</div>
      )}
    </Field>
  );
}
