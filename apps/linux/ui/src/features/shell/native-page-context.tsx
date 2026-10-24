import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { gateway } from "@/lib/bridge";

import { adminSection } from "../admin/navigation";
import { navigate, openSearch, useViewerRoute } from "./navigation";

const pageTitles = {
  home: "الرئيسية",
  search: "البحث",
  browse: "تصفّح المكتبة",
  releases: "التقويم",
  planets: "الكواكب",
  episodes: "الحلقات",
  watch: "المشاهدة",
  trailers: "الإعلانات التشويقية",
  studios: "الاستوديوهات",
  people: "الصنّاع",
  downloads: "التنزيلات",
  profile: "حسابي",
  profiles: "الملف الشخصي",
};

/** Document title is read by the trusted native WebView; it grants no native permissions. */
export function NativePageContext() {
  const { path } = useViewerRoute();
  const [area, id] = path.split("/").slice(1);
  const workId = area === "titles" ? (id ?? "") : "";
  // Observe the work page's existing query. Header context never starts another catalog request.
  const work = useQuery({
    queryKey: ["work", workId],
    queryFn: ({ signal }) => gateway.work(workId, signal),
    enabled: false,
  });
  const title =
    area === "titles"
      ? work.data?.titleAr || work.data?.canonicalTitle || "العمل"
      : area === "admin"
        ? `الإدارة · ${adminSection(id ?? "")?.title ?? "نظرة عامة"}`
        : (Object.entries(pageTitles).find(([key]) => key === (area || "home"))?.[1] ?? "نحّاسيو");
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = "نحّاسيو";
    };
  }, [title]);
  useEffect(() => {
    const home = () => navigate("/home");
    const search = () => openSearch(true);
    window.addEventListener("nahhasio:home", home);
    window.addEventListener("nahhasio:search", search);
    return () => {
      window.removeEventListener("nahhasio:home", home);
      window.removeEventListener("nahhasio:search", search);
    };
  }, []);
  return null;
}
