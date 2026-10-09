import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AdsPlatformSwitch,
  GoogleAdsOverview,
  type AdsPlatform,
} from "@/components/nex/AdsPlatformSwitch";
import { AppShell } from "@/components/nex/AppShell";
import { MetaPerformance } from "@/components/nex/MetaPerformance";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Visão geral — NEX Ads" },
      { name: "description", content: "Indicadores das campanhas lidos da conta de anúncio na Meta." },
      { property: "og:title", content: "Visão geral — NEX Ads" },
      { property: "og:description", content: "Indicadores das campanhas lidos da conta de anúncio na Meta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [platform, setPlatform] = useState<AdsPlatform>("meta");
  const subtitle =
    platform === "meta"
      ? "Indicadores lidos da conta de anúncio autorizada na Meta."
      : "Indicadores da conta de anúncio no Google Ads.";
  return (
    <AppShell live title="Visão geral" subtitle={subtitle}>
      <div className="space-y-5">
        <AdsPlatformSwitch value={platform} onChange={setPlatform} />
        {platform === "meta" ? <MetaPerformance mode="overview" /> : <GoogleAdsOverview />}
      </div>
    </AppShell>
  );
}
