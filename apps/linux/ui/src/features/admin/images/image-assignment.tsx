import { imageOwnerKindSchema, imageRoleSchema } from "@arcadia/contracts/editor-rpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { SelectField } from "@/features/editor/fields/work-fields";
import { RegisteredImage } from "@/features/editor/registered-image";

import {
  imageRoles,
  ownerKinds,
  roleLabel,
  type ImageAsset,
  type ImageOwner,
} from "./images-model";
import { assignImage, ownersOptions } from "./images.queries";

export function ImageAssignmentDialog({
  asset,
  open,
  onOpenChange,
  onAssigned,
}: {
  asset: ImageAsset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent className="max-h-11/12 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>ربط الصورة</DialogTitle>
          <DialogDescription>
            اختر السجل ونوع الصورة، ثم راجع الصورة الأساسية قبل التأكيد.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <AssignmentForm
            asset={asset}
            onBusy={setBusy}
            onAssigned={async () => {
              await onAssigned();
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
function AssignmentForm({
  asset,
  onAssigned,
  onBusy,
}: {
  asset: ImageAsset;
  onAssigned: () => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const [kind, setKind] = useState<z.infer<typeof imageOwnerKindSchema>>("title");
  const [role, setRole] = useState<z.infer<typeof imageRoleSchema>>("poster");
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ImageOwner | null>(null);
  const owners = useQuery(ownersOptions({ kind, role, q }));
  const assign = useMutation({
    mutationFn: async () => {
      onBusy(true);
      if (!selected) throw new Error("اختر سجلاً للربط.");
      return assignImage({
        assetId: asset.id,
        ownerId: selected.id,
        ownerKind: kind,
        role,
        expectedPrimaryId: selected.primaryAssignmentId,
        expectedPrimaryAssetId: selected.primaryAssetId,
      });
    },
    onSuccess: onAssigned,
    onSettled: () => onBusy(false),
  });
  return (
    <fieldset disabled={assign.isPending} className="flex min-w-0 flex-col gap-5">
      <FieldGroup className="grid sm:grid-cols-2">
        <SelectField
          label="نوع السجل"
          value={kind}
          items={ownerKinds}
          onChange={(value) => {
            setKind(value);
            setSelected(null);
            assign.reset();
          }}
        />
        <SelectField
          label="نوع الصورة"
          value={role}
          items={imageRoles}
          onChange={(value) => {
            setRole(value);
            setSelected(null);
            assign.reset();
          }}
        />
      </FieldGroup>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setQ(draft);
          setSelected(null);
        }}
      >
        <Field>
          <FieldLabel htmlFor="image-owner-search">البحث عن السجل</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="image-owner-search"
              maxLength={300}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="اسم العمل، الجزء، الحلقة أو المساهم…"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" aria-label="بحث">
                <Search data-icon="inline-start" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </form>
      {owners.isPending ? (
        <Skeleton className="h-40" />
      ) : owners.isError ? (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل السجلات</AlertTitle>
          <AlertDescription>{owners.error.message}</AlertDescription>
          <Button variant="outline" onClick={() => void owners.refetch()}>
            إعادة المحاولة
          </Button>
        </Alert>
      ) : !owners.data.length ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>لا توجد نتائج مطابقة</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex max-h-60 flex-col gap-2 overflow-y-auto" aria-label="نتائج البحث">
          {owners.data.map((owner) => (
            <Button
              key={owner.id}
              type="button"
              variant={selected?.id === owner.id ? "secondary" : "outline"}
              className="h-auto justify-start whitespace-normal text-start"
              disabled={assign.isPending}
              onClick={() => {
                setSelected(owner);
                assign.reset();
              }}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span>{owner.label}</span>
                <span className="text-xs text-muted-foreground">{owner.context}</span>
              </span>
              {selected?.id === owner.id && <Check data-icon="inline-end" />}
            </Button>
          ))}
        </div>
      )}
      {selected && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {selected.label} <Badge variant="outline">{roleLabel(role)}</Badge>
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">الصورة الأساسية الحالية</p>
              {selected.primaryAssetId ? (
                <RegisteredImage
                  assetId={selected.primaryAssetId}
                  alt="الصورة الحالية"
                  className="h-36 rounded-lg bg-muted"
                />
              ) : (
                <div className="grid h-36 place-items-center rounded-lg bg-muted text-sm text-muted-foreground">
                  لا توجد صورة أساسية
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">الصورة الجديدة</p>
              <RegisteredImage
                assetId={asset.id}
                alt={asset.fileName}
                className="h-36 rounded-lg bg-muted"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ستصبح الصورة المختارة أساسية. تبقى الصورة السابقة في المكتبة وروابطها الأخرى محفوظة.
          </p>
        </div>
      )}
      {assign.isError && (
        <Alert variant="destructive">
          <AlertTitle>لم يتغيّر الربط</AlertTitle>
          <AlertDescription>{assign.error.message}</AlertDescription>
        </Alert>
      )}
      <Button
        disabled={!selected || assign.isPending || selected.primaryAssetId === asset.id}
        onClick={() => assign.mutate()}
      >
        {assign.isPending ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Check data-icon="inline-start" />
        )}
        {assign.isPending ? "جارٍ الربط…" : "تأكيد الصورة الأساسية"}
      </Button>
    </fieldset>
  );
}
