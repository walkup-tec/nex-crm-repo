import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/master")({
  beforeLoad: ({ context }) => {
    const session = context as { user?: { id: string }; master?: boolean };
    if (!session.user) throw redirect({ to: "/auth" });
    if (!session.master) throw redirect({ to: "/dashboard" });
  },
  component: Outlet,
});
