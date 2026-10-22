import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LiveInbox } from "@/components/chatbot/LiveInbox";
import { supabase } from "@/integrations/supabase/client";

function openedConversation() {
  if (typeof window === "undefined") return "";
  const id = window.location.hash.slice(1);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : "";
}

function applyUserTheme(theme: string | null | undefined) {
  if (typeof document === "undefined") return;
  const dark = theme === "dark";
  document.documentElement.classList.toggle("dark", dark);
  if (theme === "dark" || theme === "light") localStorage.setItem("nex-theme", theme);
}

export const Route = createFileRoute("/_authenticated/chatbot/atendimento")({
  ssr: false,
  head: () => ({ meta: [{ title: "Atendimento — NEX" }] }),
  component: function ExpandedInbox() {
    const [conversationId] = useState(openedConversation);
    useEffect(() => {
      const stored = localStorage.getItem("nex-theme");
      if (stored === "dark" || stored === "light") {
        applyUserTheme(stored);
        return;
      }
      let active = true;
      void supabase.auth.getUser().then(async ({ data }) => {
        if (!active || !data.user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("theme")
          .eq("id", data.user.id)
          .maybeSingle();
        if (!active || (profile?.theme !== "dark" && profile?.theme !== "light")) return;
        applyUserTheme(profile.theme);
      });
      return () => {
        active = false;
      };
    }, []);
    return (
      <div className="chatbot-app chatbot-expanded">
        <LiveInbox expanded conversationId={conversationId} />
      </div>
    );
  },
});
