import { useEffect, useState } from "react";
import { readGoogleAdsCampaignsFn } from "@/lib/google-ads.functions";
import type { GoogleAdsCampaign } from "@/lib/google-ads";

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
  } catch {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }
}

function integer(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function GoogleAdsOverview() {
  const [campaigns, setCampaigns] = useState<GoogleAdsCampaign[]>([]);
  const [accountName, setAccountName] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [period, setPeriod] = useState("");
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void readGoogleAdsCampaignsFn({ data: {} }).then((result) => {
      if (!active) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setLinked(result.data.linked);
      setCampaigns(result.data.campaigns);
      setAccountName(result.data.account?.name ?? "");
      setCurrency(result.data.account?.currency || "BRL");
      setPeriod(result.data.period ?? "");
    });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="h-28 animate-pulse rounded-lg bg-muted" />;
  if (error) {
    return (
      <div className="rounded-lg border bg-card p-5">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }
  if (!linked) {
    return (
      <div className="rounded-lg border bg-card p-5">
        <p className="text-xs font-medium text-muted-foreground">Conta de anúncios</p>
        <p className="mt-1 font-semibold">Conta Google Ads não vinculada</p>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Os indicadores do Google Ads entram nesta visão quando o Master vincular a conta. A Meta continua na outra opção.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-5">
        <p className="text-xs font-medium text-muted-foreground">Conta de anúncios</p>
        <p className="mt-1 font-semibold">{accountName}</p>
        <p className="mt-1 text-sm text-muted-foreground">{period}. Consulta somente de leitura.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Campanha</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="px-4 py-3 font-medium">Impressões</th>
              <th className="px-4 py-3 font-medium">Cliques</th>
              <th className="px-4 py-3 font-medium">Custo</th>
              <th className="px-4 py-3 font-medium">Conversões</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length ? campaigns.map((campaign) => (
              <tr key={campaign.id} className="border-t">
                <td className="px-4 py-3">{campaign.name}</td>
                <td className="px-4 py-3">{campaign.status}</td>
                <td className="px-4 py-3">{integer(campaign.impressions)}</td>
                <td className="px-4 py-3">{integer(campaign.clicks)}</td>
                <td className="px-4 py-3">{money(campaign.cost, currency)}</td>
                <td className="px-4 py-3">{integer(campaign.conversions)}</td>
              </tr>
            )) : (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={6}>Nenhuma campanha nos últimos 30 dias.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
