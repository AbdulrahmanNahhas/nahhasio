import { ProfileUpdateSchema, type User } from "@nahhasio/api-contract";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ImagePlus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { gateway } from "@/lib/bridge";

import { AccountAvatar, avatarChoices } from "./account-avatar";

export function ProfileEditor({ user }: { user: User }) {
  const client = useQueryClient();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [avatarKey, setAvatarKey] = useState(user.avatarKey);
  const [search, setSearch] = useState("");
  const [avatarGroup, setAvatarGroup] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState(user.avatarKey);
  const nameInput = useRef<HTMLInputElement>(null);
  const update = useMutation({
    mutationFn: gateway.updateProfile,
    onSuccess: (next) => {
      client.setQueryData(["profile"], next);
      client.setQueryData(
        ["session"],
        (session: { user: User; expiresAt: string } | null | undefined) =>
          session ? { ...session, user: next } : session,
      );
      void client.invalidateQueries({ queryKey: ["public-profile", user.accountId] });
      toast.add({ type: "success", title: "تم حفظ ملفك الشخصي" });
      setName(next.name);
      setBio(next.bio);
      setAvatarKey(next.avatarKey);
      nameInput.current?.focus({ preventScroll: true });
    },
  });
  const changed = name.trim() !== user.name || bio !== user.bio || avatarKey !== user.avatarKey;
  const choices = avatarChoices.filter((avatar) => {
    const group = /(^|\/)(anon|minimal)/.test(avatar.key) ? "symbols" : "characters";
    return (
      (avatarGroup === "all" || avatarGroup === group) &&
      `${avatar.label} ${avatar.key}`.toLowerCase().includes(search.trim().toLowerCase())
    );
  });
  function resetDraft() {
    setName(user.name);
    setBio(user.bio);
    setAvatarKey(user.avatarKey);
    setSearch("");
    setAvatarGroup("all");
    setPickerOpen(false);
    update.reset();
  }

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = ProfileUpdateSchema.safeParse({
      name: name.trim(),
      bio,
      avatarKey,
      updatedAt: user.updatedAt,
    });
    if (changed && !update.isPending && input.success) update.mutate(input.data);
  }

  const avatarPicker = (
    <Field>
      <FieldLabel htmlFor="avatar-search">اختر صورة حسابك</FieldLabel>
      <Input
        id="avatar-search"
        type="search"
        placeholder="ابحث عن شخصية أو مجموعة…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <ToggleGroup
        value={[avatarGroup]}
        onValueChange={([value]) => {
          if (value) setAvatarGroup(value);
        }}
        size="sm"
        variant="outline"
        spacing={2}
        aria-label="مجموعات الصور"
        className="flex-wrap"
      >
        <ToggleGroupItem value="all">الكل</ToggleGroupItem>
        <ToggleGroupItem value="characters">الشخصيات</ToggleGroupItem>
        <ToggleGroupItem value="symbols">الرموز</ToggleGroupItem>
      </ToggleGroup>
      <RadioGroup
        aria-label="صورة الحساب"
        value={pendingAvatar}
        onValueChange={(value) => {
          const selection = ProfileUpdateSchema.pick({ avatarKey: true }).safeParse({
            avatarKey: value,
          });
          if (selection.success) setPendingAvatar(selection.data.avatarKey);
        }}
        className="grid grid-cols-5 gap-3 max-sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7"
      >
        {choices.map((avatar) => (
          <Field key={avatar.key} className="relative">
            <RadioGroupItem
              id={`avatar-${avatar.key}`}
              value={avatar.key}
              aria-label={avatar.label}
              disabled={update.isPending}
              className="sr-only"
            />
            <FieldLabel
              htmlFor={`avatar-${avatar.key}`}
              className="relative flex aspect-square cursor-pointer items-center justify-center rounded-sm p-1 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-data-checked:ring-2 peer-data-checked:ring-primary"
              title={avatar.label}
            >
              <span aria-hidden="true" className="">
                <AccountAvatar
                  name={avatar.label}
                  avatarKey={avatar.key}
                  className="size-full p-1"
                />
              </span>
              <span className="sr-only">{avatar.label}</span>
              {pendingAvatar === avatar.key && (
                <span className="absolute inset-e-1 bottom-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-4" aria-hidden="true" />
                </span>
              )}
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>
      {choices.length === 0 && (
        <FieldDescription>لا توجد صورة مطابقة. جرّب اسمًا آخر.</FieldDescription>
      )}
    </Field>
  );
  const profileFields = (
    <>
      <Field>
        <FieldLabel htmlFor="profile-name">الاسم</FieldLabel>
        <Input
          ref={nameInput}
          id="profile-name"
          maxLength={80}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={update.isPending}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="profile-bio">نبذة عنك</FieldLabel>
        <Textarea
          id="profile-bio"
          maxLength={500}
          rows={3}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          disabled={update.isPending}
          placeholder="أعمال تحبّها، وشخصيات لا تنساها…"
        />
        {bio.length > 0 && (
          <FieldDescription dir="ltr" className="text-end">
            {bio.length} / 500
          </FieldDescription>
        )}
      </Field>
    </>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>الملف والصورة</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <Dialog
            open={pickerOpen}
            onOpenChange={(open) => {
              if (open) {
                setPendingAvatar(avatarKey);
                setSearch("");
                setAvatarGroup("all");
              }
              setPickerOpen(open);
            }}
          >
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  className="h-auto flex-col gap-2 rounded-xl p-2"
                  aria-label="تغيير الصورة"
                />
              }
            >
              <AccountAvatar name={name} avatarKey={avatarKey} className="size-24 shrink-0" />
              <span className="flex items-center gap-1.5">
                <ImagePlus data-icon="inline-start" aria-hidden="true" />
                تغيير الصورة
              </span>
            </DialogTrigger>
            <DialogContent className="flex max-h-5/6 flex-col gap-0 sm:max-w-3xl">
              <DialogHeader className="shrink-0">
                <DialogTitle>صورة الحساب</DialogTitle>
                <DialogDescription className="sr-only">
                  ابحث أو تصفّح مجموعات الصور.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-4">
                {avatarPicker}
              </div>
              <DialogFooter className="shrink-0">
                <DialogClose render={<Button variant="outline" />}>إلغاء</DialogClose>
                <Button
                  variant="ghost"
                  disabled={pendingAvatar === user.avatarKey}
                  onClick={() => setPendingAvatar(user.avatarKey)}
                >
                  استعادة الصورة المحفوظة
                </Button>
                <Button
                  onClick={() => {
                    setAvatarKey(pendingAvatar);
                    setPickerOpen(false);
                  }}
                >
                  تم الاختيار
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <p className="max-w-full truncate text-lg font-semibold" dir="auto">
              {name || "اسمك"}
            </p>
            <Badge variant="secondary">{user.isAdmin ? "مشرف" : "عضو"}</Badge>
            <a
              className={buttonVariants({ variant: "outline", size: "sm" })}
              href={`#/profiles/${user.accountId}`}
            >
              عرض الملف الشخصي
            </a>
          </div>
        </div>
        <form id="profile-editor-form" onSubmit={submitProfile}>
          <FieldGroup>{profileFields}</FieldGroup>
        </form>
        {update.error && (
          <Alert variant="destructive">
            <AlertDescription>{update.error.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      {changed && (
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">تغييرات غير محفوظة</span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              disabled={update.isPending}
              onClick={() => {
                resetDraft();
                nameInput.current?.focus({ preventScroll: true });
              }}
            >
              تراجع
            </Button>
            <Button
              type="submit"
              form="profile-editor-form"
              disabled={update.isPending || !name.trim()}
            >
              {update.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
