import { createFileRoute, redirect, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { AdsPlatformSwitch, type AdsPlatform } from "@/components/nex/AdsPlatformSwitch";
import { GoogleAdsOverview } from "@/components/nex/GoogleAdsPerformance";
import { AppShell } from "@/components/nex/AppShell";
import { MetaPerformance } from "@/components/nex/MetaPerformance";
import { Button } from "@/components/ui/button";
import { adsDashboardOrder, commercialOffer } from "@/lib/user-access";

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: ({ context }) => {
    if ((context as { master?: boolean }).master) throw redirect({ to: "/master" });
  },
  head: () => ({
    meta: [
      { title: "Dashboard Anúncios — NEX Ads" },
      { name: "description", content: "Indicadores das campanhas lidos da conta de anúncio na Meta." },
      { property: "og:title", content: "Dashboard Anúncios — NEX Ads" },
      { property: "og:description", content: "Indicadores das campanhas lidos da conta de anúncio na Meta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l5.9-1.1A11 11 0 0 0 20.5 3.5Zm-8.5 17a9.1 9.1 0 0 1-4.6-1.3l-.3-.2-3.5.7.7-3.4-.2-.3A9.1 9.1 0 1 1 12 20.5Zm5-6.8c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.2-.3a.5.5 0 0 0 0-.5c0-.1-.6-1.4-.8-1.9s-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4.1 15 15 0 0 0 1.5.6 3.6 3.6 0 0 0 1.7.1 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3Z" />
    </svg>
  );
}

function DashboardPage() {
  const session = useRouteContext({ strict: false }) as { adsMeta?: boolean; adsGoogle?: boolean } | undefined;
  const flags = { adsMeta: session?.adsMeta === true, adsGoogle: session?.adsGoogle === true };
  const order = adsDashboardOrder(flags);
  const [platform, setPlatform] = useState<AdsPlatform>(order[0]);
  const subscribed = platform === "meta" ? flags.adsMeta : flags.adsGoogle;
  const offer = commercialOffer(platform);
  const subtitle = subscribed
    ? platform === "meta"
      ? "Indicadores lidos da conta de anúncio autorizada na Meta."
      : "Indicadores da conta de anúncio no Google Ads."
    : `Proposta comercial para o ${offer.product}.`;
  const chart = platform === "meta" ? <MetaPerformance mode="overview" /> : <GoogleAdsOverview />;
  return (
    <AppShell live title="Dashboard Anúncios" subtitle={subtitle}>
      <div className="space-y-5">
        <AdsPlatformSwitch value={platform} onChange={setPlatform} order={order} />
        <div className="relative">
          <div className={subscribed ? undefined : "pointer-events-none select-none blur-md"} aria-hidden={subscribed ? undefined : true}>
            {chart}
          </div>
          {subscribed ? null : (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-lg rounded-lg border bg-card/95 p-6 text-center">
                <p className="text-sm leading-6">{offer.message}</p>
                <Button asChild className="mt-4">
                  <a href={offer.href} target="_blank" rel="noreferrer">
                    <WhatsAppIcon />
                    Chame o comercial
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
