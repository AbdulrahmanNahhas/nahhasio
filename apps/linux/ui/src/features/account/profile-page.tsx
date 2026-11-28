import type { PublicProfile } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useEffect } from "react";

import { Separator } from "@/components/ui-sdk/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { gateway } from "@/lib/bridge";

import { replaceParams } from "../shell/navigation";
import { AccountAvatar } from "./account-avatar";
import { ProfileActivity } from "./profile-activity";

function ProfileLoading() {
  return (
    <section
      className="mx-auto flex max-w-5xl flex-col gap-8 p-8"
      aria-busy="true"
      aria-label="تحميل الملف الشخصي"
    >
      <Skeleton className="size-36" />
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-40 w-full" />
    </section>
  );
}
function ProfileError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <section className="mx-auto max-w-3xl p-8">
      <Alert variant="destructive">
        <AlertTitle>تعذّر فتح الملف الشخصي</AlertTitle>
        <AlertDescription>
          {message}
          <Button variant="outline" onClick={retry}>
            إعادة المحاولة
          </Button>
        </AlertDescription>
      </Alert>
    </section>
  );
}
export function ProfilePage({ id }: { id?: string }) {
  const account = useQuery({
    queryKey: ["profile"],
    queryFn: ({ signal }) => gateway.profile(signal),
    staleTime: 0,
  });
  const accountId = account.data?.accountId;
  const profileId = id ?? accountId;
  useEffect(() => {
    if (id || !accountId) return;
    replaceParams(`/profiles/${accountId}`, new URLSearchParams());
  }, [id, accountId]);
  const result = useQuery({
    queryKey: ["public-profile", profileId],
    queryFn: ({ signal }) => gateway.publicProfile(profileId!, signal),
    enabled: Boolean(profileId),
  });
  if (account.error)
    return <ProfileError message={account.error.message} retry={() => void account.refetch()} />;
  if (!id || account.isPending || result.isPending) return <ProfileLoading />;
  if (result.error)
    return (
      <ProfileError
        message={result.error.message}
        retry={() => {
          void account.refetch();
          void result.refetch();
        }}
      />
    );
  const profile = result.data;
  if (!profile) return <ProfileLoading />;
  return <ProfileView profile={profile} owner={accountId === profile.id} />;
}

function ProfileView({ profile, owner }: { profile: PublicProfile; owner: boolean }) {
  return (
    <article
      className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-12 max-sm:px-5 max-sm:py-8"
      aria-label="الملف الشخصي"
    >
      <header className="flex flex-wrap items-start gap-4 sm:items-center sm:gap-6">
        <AccountAvatar
          name={profile.name}
          avatarKey={profile.avatarKey}
          className="size-28 shrink-0 max-sm:size-20"
        />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <h1
            className="font-display text-3xl font-semibold break-words max-sm:text-2xl"
            dir="auto"
          >
            {profile.name}
          </h1>
          {profile.joinedAt && (
            <p className="text-sm text-muted-foreground">
              عضو منذ{" "}
              {new Date(profile.joinedAt).toLocaleDateString("ar-u-nu-latn", {
                year: "numeric",
                month: "long",
              })}
            </p>
          )}
          {profile.bio && (
            <p
              className="max-w-2xl leading-7 whitespace-pre-wrap break-words text-muted-foreground"
              dir="auto"
            >
              {profile.bio}
            </p>
          )}
        </div>
        {owner && (
          <a className={buttonVariants({ variant: "outline" })} href="#/settings?section=account">
            <Pencil data-icon="inline-start" />
            تعديل الملف
          </a>
        )}
      </header>
      <Separator />
      <ProfileActivity key={profile.id} id={profile.id} />
    </article>
  );
}
