import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/practice/$qid")({
  head: () => ({ meta: [{ title: "Practice → Homework · PY Kidda" }, { name: "robots", content: "noindex" }] }),
  component: () => <Navigate to="/assignments" replace />,
  ssr: false,
});
