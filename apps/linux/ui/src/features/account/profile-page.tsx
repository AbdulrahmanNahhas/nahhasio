import type { PublicProfile, User } from "@nahhasio/api-contract";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { gateway } from "@/lib/bridge";

import { useViewerRoute, navigate } from "../shell/navigation";
import { AccountAvatar } from "./account-avatar";
import { ProfileActivity } from "./profile-activity";
import { ProfileEditor } from "./profile-editor";

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
  const route = useViewerRoute();
  const profileId = id ?? account.data?.accountId;
  const result = useQuery({
    queryKey: ["public-profile", profileId],
    queryFn: ({ signal }) => gateway.publicProfile(profileId!, signal),
    enabled: !!profileId,
  });
  if (account.error)
    return <ProfileError message={account.error.message} retry={() => void account.refetch()} />;
  if (account.isPending || result.isPending) return <ProfileLoading />;
  const error = account.error ?? result.error;
  if (error)
    return (
      <ProfileError
        message={error.message}
        retry={() => {
          void account.refetch();
          void result.refetch();
        }}
      />
    );
  const profile = result.data;
  if (!profile) return <ProfileLoading />;
  const owner = account.data?.accountId === profile.id ? account.data : undefined;
  const edit = route.params.get("edit");
  return (
    <>
      <ProfileView
        profile={profile}
        owner={owner}
        onEdit={() => navigate(`${route.path}?edit=profile`)}
      />
      {owner && (
        <ProfileEditor
          user={owner}
          section={edit}
          basePath={route.path}
          onClose={() => navigate(route.path)}
        />
      )}
    </>
  );
}
function ProfileView({
  profile,
  owner,
  onEdit,
}: {
  profile: PublicProfile;
  owner?: User;
  onEdit: () => void;
}) {
  return (
    <article
      className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-12 max-sm:px-5 max-sm:py-8"
      aria-label="الملف الشخصي"
    >
      <header className="flex flex-wrap items-center gap-5">
        <AccountAvatar
          name={profile.name}
          avatarKey={profile.avatarKey}
          className="size-28 shrink-0 max-sm:size-20"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h1 className="font-display text-3xl font-semibold break-words max-sm:text-2xl">
            {profile.name}
          </h1>
          {profile.joinedAt && (
            <p className="text-sm text-muted-foreground">
              عضو منذ{" "}
              {new Date(profile.joinedAt).toLocaleDateString("ar", {
                year: "numeric",
                month: "long",
              })}
            </p>
          )}
        </div>
        {owner && (
          <Button variant="outline" onClick={onEdit}>
            <Pencil data-icon="inline-start" />
            تعديل الملف
          </Button>
        )}
      </header>
      <Separator />
      <p className="max-w-2xl text-base leading-8 whitespace-pre-wrap break-words text-muted-foreground">
        {profile.bio || "لم تُضف نبذة بعد."}
      </p>
      <ProfileActivity key={profile.id} id={profile.id} />
    </article>
  );
}
