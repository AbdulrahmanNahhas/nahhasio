import { useRouterState } from "@tanstack/react-router";

import { router } from "../../app/router";

export function entityLink(key: "planets" | "contributors" | "studios", value: string) {
  return `#/${key === "contributors" ? "people" : key}/${encodeURIComponent(value)}`;
}
export type ViewerRoute = { path: string; params: URLSearchParams; key: string };
export function useViewerRoute(): ViewerRoute {
  const location = useRouterState({ select: (state) => state.location });
  return {
    path: location.pathname,
    params: new URLSearchParams(location.searchStr),
    key: `${location.pathname}${location.searchStr}`,
  };
}
export function workLink(id: string, installmentId?: string) {
  return `#/titles/${id}${installmentId ? `?installment=${encodeURIComponent(installmentId)}` : ""}`;
}
export function navigate(path: string) {
  void router.navigate({ href: path, resetScroll: false });
}
export function openSearch() {
  window.dispatchEvent(new Event("nahhasio:quick-search"));
}
export function replaceParams(path: string, params: URLSearchParams) {
  void router.navigate({
    href: `${path}${params.size ? `?${params}` : ""}`,
    replace: true,
    resetScroll: false,
  });
}
