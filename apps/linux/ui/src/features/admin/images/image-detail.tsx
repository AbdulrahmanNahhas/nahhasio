import { useMutation, useQuery } from "@tanstack/react-query";
import { Link2, Unlink, X } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { RegisteredImage } from "@/features/editor/registered-image";

import { ImageAssignmentDialog } from "./image-assignment";
import { ImageDelete } from "./image-delete";
import {
  fileSize,
  roleLabel,
  healthLabel,
  ownerLink,
  type ImageAsset,
  type ImageAssignment,
} from "./images-model";
import { imageOptions, unlinkImage } from "./images.queries";

export function ImageDetail({
  id,
  onClose,
  onChanged,
  previewAsset,
}: {
  previewAsset?: ImageAsset;
  id: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [displayId, setDisplayId] = useState(id);
  if (id && id !== displayId) setDisplayId(id);
  return (
    <Drawer
      showSwipeHandle
      open={Boolean(id)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent className="h-144">
        <DrawerHeader>
          <DrawerTitle>تفاصيل الصورة</DrawerTitle>
          <DrawerDescription>بيانات الصورة والسجلات المرتبطة بها.</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {displayId && (
            <DetailBody
              key={displayId}
              id={displayId}
              previewAsset={previewAsset}
              onChanged={onChanged}
              onClose={onClose}
            />
          )}
        </div>
        <DrawerFooter className="items-end">
          <DrawerClose render={<Button variant="outline" />}>
            <X data-icon="inline-start" />
            إغلاق
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
function DetailBody({
  id,
  onChanged,
  onClose,
  previewAsset,
}: {
  previewAsset?: ImageAsset;
  id: string;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const image = useQuery(imageOptions(id));
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<ImageAssignment | null>(null);
  const unlink = useMutation({
    mutationFn: async () => {
      if (!removing) throw new Error("اختر الربط الذي تريد إزالته.");
      return unlinkImage({
        assetId: id,
        assignmentId: removing.id,
        expectedPrimary: removing.isPrimary,
      });
    },
    onSuccess: async () => {
      setRemoving(null);
      await onChanged();
    },
  });
  if (image.isPending)
    return (
      <div className="mx-auto grid w-full max-w-400 gap-5 p-4 sm:p-6 lg:grid-cols-3">
        <div className="order-2 flex min-w-0 flex-col gap-5 lg:order-1">
          {previewAsset && (
            <h2 className="break-all font-semibold" dir="auto">
              {previewAsset.fileName}
            </h2>
          )}
          <Skeleton className="h-40" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
        <div className="order-1 flex min-w-0 flex-col gap-3 lg:order-2">
          {previewAsset ? (
            <RegisteredImage
              assetId={previewAsset.id}
              alt={previewAsset.fileName}
              className="h-72 w-full rounded-xl bg-muted lg:h-96"
            />
          ) : (
            <Skeleton className="h-72 lg:h-96" />
          )}
        </div>
        <div className="order-3 flex min-w-0 flex-col gap-4">
          <Skeleton className="h-12" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  if (image.isError)
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>تعذّر تحميل الصورة</AlertTitle>
          <AlertDescription>{image.error.message}</AlertDescription>
          <Button variant="outline" onClick={() => void image.refetch()}>
            إعادة المحاولة
          </Button>
        </Alert>
      </div>
    );
  const { asset, assignments } = image.data;
  return (
    <div className="mx-auto grid w-full max-w-400 gap-5 p-4 sm:p-6 lg:grid-cols-3">
      <div className="order-2 flex min-w-0 flex-col gap-5 lg:order-1">
        <div className="flex flex-col gap-3">
          <h2 className="break-all font-semibold" dir="auto">
            {asset.fileName}
          </h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">الأبعاد</dt>
              <dd dir="ltr">
                {asset.width} × {asset.height}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">الحجم</dt>
              <dd>{fileSize(asset.byteSize)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">الصيغة</dt>
              <dd dir="ltr">{asset.mimeType.replace("image/", "").toUpperCase()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">تاريخ الإضافة</dt>
              <dd>
                {new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(
                  new Date(asset.createdAt),
                )}
              </dd>
            </div>
          </dl>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">المعرّف والمسار وبصمة الملف</summary>
            <dl className="mt-3 flex flex-col gap-2 break-all" dir="ltr">
              <div>
                <dt>ID</dt>
                <dd>{asset.id}</dd>
              </div>
              <div>
                <dt>Path</dt>
                <dd>{asset.path}</dd>
              </div>
              <div>
                <dt>SHA-256</dt>
                <dd>{asset.sha256}</dd>
              </div>
            </dl>
          </details>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Badge variant={asset.health === "healthy" ? "outline" : "destructive"}>
            {healthLabel(asset.health)}
          </Badge>
          <ImageDelete
            asset={asset}
            onDeleted={async () => {
              onClose();
              await onChanged();
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          فحص توفر الملف وصلاحية قراءته وحجمه؛ لا يفحص فساد محتوى الصورة.
        </p>
      </div>
      <div className="order-1 flex min-w-0 flex-col gap-3 lg:order-2">
        <RegisteredImage
          assetId={asset.id}
          alt={asset.fileName}
          className="h-72 w-full rounded-xl bg-muted lg:h-96"
        />
      </div>
      <div className="order-3 flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">
            السجلات المرتبطة <Badge variant="secondary">{assignments.length}</Badge>
          </h3>
          <Button variant="outline" onClick={() => setAssigning(true)}>
            <Link2 data-icon="inline-start" />
            ربط بسجل
          </Button>
        </div>
        {!assignments.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>الصورة غير مرتبطة</EmptyTitle>
              <EmptyDescription>
                اختر عملاً أو جزءاً أو حلقة أو مساهماً لربط الصورة به.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup>
            {assignments.map((item) => (
              <Item key={item.id} variant="outline" size="sm" className="flex-col items-stretch">
                <ItemContent>
                  <ItemTitle>{item.ownerLabel}</ItemTitle>
                  <ItemDescription>{item.ownerContext}</ItemDescription>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{roleLabel(item.role)}</Badge>
                    <Badge variant={item.isPrimary ? "secondary" : "outline"}>
                      {item.isPrimary ? "أساسية" : "إضافية"}
                    </Badge>
                  </div>
                </ItemContent>
                <ItemActions className="flex-wrap">
                  {ownerLink(item) && (
                    <a
                      href={ownerLink(item) ?? undefined}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      عرض السجل
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={unlink.isPending}
                    onClick={() => {
                      unlink.reset();
                      setRemoving(item);
                    }}
                  >
                    <Unlink data-icon="inline-start" />
                    إزالة الربط
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </div>
      <ImageAssignmentDialog
        asset={asset}
        open={assigning}
        onOpenChange={setAssigning}
        onAssigned={onChanged}
      />
      <AlertDialog
        open={Boolean(removing)}
        onOpenChange={(open) => {
          if (!open && !unlink.isPending) setRemoving(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إزالة ربط الصورة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيزال ارتباط الصورة بـ «{removing?.ownerLabel}». يبقى ملف الصورة وروابطها الأخرى في
              المكتبة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {unlink.isError && (
            <Alert variant="destructive">
              <AlertTitle>لم يُزل الربط</AlertTitle>
              <AlertDescription>{unlink.error.message}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlink.isPending}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={unlink.isPending}
              onClick={() => unlink.mutate()}
            >
              {unlink.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Unlink data-icon="inline-start" />
              )}
              إزالة الربط
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
