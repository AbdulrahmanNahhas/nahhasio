import { cn } from "cn";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Shared, packaged assets: no dependency on this device's Pictures or Downloads folders.
const assets = import.meta.glob<string>("../../../../../../assets/avatars/**/*.png", {
  eager: true,
  query: "?url",
  import: "default",
});
const names = {
  anon: "رمز ملون",
  "minimal-animal": "الحيوانات",
  avatar: "أفاتار",
  bighero6: "الأبطال الستة",
  brave: "الشجاعة",
  cars: "سيارات",
  coco: "كوكو",
  donaldduck: "بطوط",
  frozen: "فروزن",
  iceage: "العصر الجليدي",
  insideout: "قلبًا وقالبًا",
  invinsible: "الخارقون",
  "iron-man": "الرجل الحديدي",
  mickey: "ميكي",
  monsters: "شركة المرعبين",
  ralph: "رالف",
  ratatouille: "خلطبيطة بالصلصة",
  sonic: "سونيك",
  "spider-man": "الرجل العنكبوت",
  starwars: "حرب النجوم",
  toystory: "حكاية لعبة",
  up: "فوق",
  "wall-e": "وول إي",
  wolverine: "وولفرين",
  zootopia: "زوتوبيا",
  "3below": "ثلاثة في الأسفل",
  bossbaby: "الطفل الزعيم",
  bot: "روبوت",
  trollhunter: "صيادو الترول",
};
export const avatarChoices: { key: string; label: string; src?: string }[] = Object.entries(assets)
  .toSorted(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([path, src]) => {
    const key = path.split("/assets/avatars/")[1];
    const file = key
      .split("/")
      .at(-1)!
      .replace(/\.png$/, "");
    const family = file.replace(/-\d+$/, "");
    const number = file.match(/-(\d+)$/)?.[1];
    return {
      key,
      src,
      label: `${Object.entries(names).find(([familyKey]) => familyKey === family)?.[1] ?? family}${number ? ` ${number}` : ""}`,
    };
  });
export function avatarSource(key: string) {
  const currentKey =
    key === "nahhasio-library.svg" || key === "nahhasio-orbit.svg" ? "anon-1.png" : key;
  return avatarChoices.find((avatar) => avatar.key === currentKey)?.src;
}
export function AccountAvatar({
  name,
  avatarKey,
  className,
}: {
  name: string;
  avatarKey: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("rounded-sm! after:rounded-sm! object-contain!", className)}>
      <AvatarImage
        src={avatarSource(avatarKey)}
        alt={`صورة ${name}`}
        className="rounded-sm! object-contain!"
      />
      <AvatarFallback className="rounded-sm!">{name.trim().charAt(0)}</AvatarFallback>
    </Avatar>
  );
}
