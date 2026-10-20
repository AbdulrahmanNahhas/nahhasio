import { ProfileUpdateSchema, type User } from "@nahhasio/api-contract";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Save, X } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { gateway } from "@/lib/bridge";

import { CacheControl } from "../player/cache-control";
import { navigate } from "../shell/navigation";
import { AccountAvatar, avatarChoices } from "./account-avatar";
import { PasswordCard } from "./password-card";

export function ProfileEditor({
  user,
  section,
  onClose,
  basePath,
}: {
  user: User;
  section: string | null;
  onClose: () => void;
  basePath: string;
}) {
  const client = useQueryClient();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [avatarKey, setAvatarKey] = useState(user.avatarKey);
  const [search, setSearch] = useState("");
  const [discard, setDiscard] = useState(false);
  const [lastSection, setLastSection] = useState(section ?? "profile");
  const activeSection = section ?? lastSection;
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
      onClose();
    },
  });
  const changed = name.trim() !== user.name || bio !== user.bio || avatarKey !== user.avatarKey;
  const choices = avatarChoices.filter((avatar) =>
    `${avatar.label} ${avatar.key}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <Drawer
      swipeDirection="down"
      showSwipeHandle
      open={section !== null}
      onOpenChangeComplete={(open) => {
        if (open) return;
        setName(user.name);
        setBio(user.bio);
        setAvatarKey(user.avatarKey);
        setSearch("");
        setDiscard(false);
        setLastSection("profile");
        update.reset();
      }}
      onOpenChange={(open) => {
        if (open || update.isPending) return;
        if (changed) setDiscard(true);
        else onClose();
      }}
    >
      <DrawerContent className="mx-auto h-[85dvh] w-full max-w-3xl" dir="rtl">
        <DrawerHeader className="relative px-6 pb-4">
          <DrawerClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-3 inset-e-4"
                aria-label="إغلاق الإعدادات"
              />
            }
          >
            <X />
          </DrawerClose>
          <DrawerTitle>إعداداتك</DrawerTitle>
          <DrawerDescription>ملفك في المكتبة، أمان حسابك، وهذا الجهاز.</DrawerDescription>
        </DrawerHeader>
        <Tabs
          value={activeSection}
          onValueChange={(value) => {
            setLastSection(value);
            navigate(`${basePath}?edit=${value}`);
          }}
          className="min-h-0 flex-1 gap-0"
        >
          <TabsList variant="line" className="mx-6 mb-4 shrink-0">
            <TabsTrigger value="profile">الملف والصورة</TabsTrigger>
            <TabsTrigger value="security">أمان الحساب</TabsTrigger>
            <TabsTrigger value="device">الجهاز</TabsTrigger>
          </TabsList>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6">
            {discard && (
              <Alert className="mb-5 shrink-0">
                <AlertDescription>
                  لديك تغييرات لم تُحفظ.
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setDiscard(false)}>
                      متابعة التعديل
                    </Button>
                    <Button variant="destructive" onClick={onClose}>
                      تجاهل التغييرات
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {activeSection === "profile" && (
              <TabsContent value="profile" className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <form
                  id="profile-editor-form"
                  className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain pb-6 scroll-fade-y overflow-x-hidden"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const input = ProfileUpdateSchema.safeParse({
                      name: name.trim(),
                      bio,
                      avatarKey,
                      updatedAt: user.updatedAt,
                    });
                    if (input.success) update.mutate(input.data);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <AccountAvatar name={name} avatarKey={avatarKey} className="size-20 shrink-0" />
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="truncate text-lg font-semibold">{name || "اسمك"}</p>
                      <p className="text-sm text-muted-foreground">
                        هكذا يظهر اسمك وصورتك لأهل المكتبة.
                      </p>
                    </div>
                  </div>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="profile-name">الاسم</FieldLabel>
                      <Input
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
                      <FieldDescription>اختياري · {bio.length} / 500</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="avatar-search">اختر صورة حسابك</FieldLabel>
                      <Input
                        id="avatar-search"
                        type="search"
                        placeholder="ابحث عن شخصية أو مجموعة…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                      <RadioGroup
                        aria-label="صورة الحساب"
                        value={avatarKey}
                        onValueChange={(value) => {
                          const selection = ProfileUpdateSchema.pick({ avatarKey: true }).safeParse(
                            {
                              avatarKey: value,
                            },
                          );
                          if (selection.success) setAvatarKey(selection.data.avatarKey);
                        }}
                        className="grid grid-cols-5 gap-3 max-sm:grid-cols-4"
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
                              {avatarKey === avatar.key && (
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
                  </FieldGroup>
                  {update.error && (
                    <Alert variant="destructive">
                      <AlertDescription>{update.error.message}</AlertDescription>
                    </Alert>
                  )}
                </form>
                <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border py-4">
                  <Button
                    type="submit"
                    form="profile-editor-form"
                    disabled={update.isPending || !changed || !name.trim()}
                  >
                    <Save data-icon="inline-start" />
                    {update.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    disabled={update.isPending}
                    onClick={() => {
                      if (changed) setDiscard(true);
                      else onClose();
                    }}
                  >
                    إلغاء
                  </Button>
                </div>
              </TabsContent>
            )}
            {activeSection === "security" && (
              <TabsContent
                value="security"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 scroll-fade-y"
              >
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-muted-foreground">بريد تسجيل الدخول</p>
                    <p dir="ltr" className="break-all text-start">
                      {user.email}
                    </p>
                  </div>
                  <PasswordCard />
                </div>
              </TabsContent>
            )}
            {activeSection === "device" && (
              <TabsContent
                value="device"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 scroll-fade-y"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>التخزين على هذا الجهاز</CardTitle>
                    <CardDescription>
                      الملفات المؤقتة والتنزيلات تخص هذا الجهاز وحده.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CacheControl />
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </div>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
}
