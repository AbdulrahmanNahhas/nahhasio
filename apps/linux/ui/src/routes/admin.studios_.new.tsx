import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/studios_/new")({
  beforeLoad: () => {
    throw redirect({
      to: "/admin/studios",
      search: {
        q: "",
        page: "1",
        image: "all",
        usage: "all",
        sort: "works",
        view: "grid",
        person: "new",
      },
    });
  },
});
