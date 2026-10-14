import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/admin/people_/$entityId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/admin/people",
      search: {
        q: "",
        page: "1",
        image: "all",
        usage: "all",
        sort: "works",
        view: "grid",
        person: params.entityId,
      },
    });
  },
});
