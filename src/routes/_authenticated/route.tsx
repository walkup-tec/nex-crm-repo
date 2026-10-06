import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase.from("profiles").select("is_blocked, organization_id").eq("id", data.user.id).maybeSingle();
    if (profile?.is_blocked) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    if (profile?.organization_id) {
      const [{ data: org }, { data: roles }] = await Promise.all([
        supabase.from("organizations").select("status").eq("id", profile.organization_id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      ]);
      const master = roles?.some((row) => row.role === "master");
      const closed = org?.status === "disabled" || org?.status === "blocked" || org?.status === "contract_ended";
      if (!master && closed) {
        await supabase.auth.signOut();
        throw redirect({ href: "/auth?motivo=inativo" });
      }
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
