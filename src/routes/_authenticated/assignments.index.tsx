import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/assignments/")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex" }],
  }),
  component: () => <Navigate to="/homework" replace />,
  ssr: false,
});
