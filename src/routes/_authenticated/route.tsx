import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { readMasterRoles } from "@/lib/master-role";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_blocked, organization_id")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.is_blocked) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    const { master } = await readMasterRoles(data.user.id);
    if (profile?.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("status")
        .eq("id", profile.organization_id)
        .maybeSingle();
      const closed =
        org?.status === "disabled" || org?.status === "blocked" || org?.status === "contract_ended";
      if (!master && closed) {
        await supabase.auth.signOut();
        throw redirect({ href: "/auth?motivo=inativo" });
      }
    }
    return { user: data.user, master };
  },
  component: () => <Outlet />,
});
