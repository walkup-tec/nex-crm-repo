import type { InsightItem } from "@/lib/nex-intelligence/dashboard/types";
import { ni } from "@/components/nex/intelligence/intelligence-theme";

type Props = {
  insights: InsightItem[];
};

export function InsightsPanel({ insights }: Props) {
  return (
    <div className={`${ni.card} h-full p-4`}>
      <h3 className={ni.title}>Insights do dia</h3>
      {insights.length === 0 ? (
        <p className={`mt-4 ${ni.muted}`}>
          Sem diagnósticos validados nesta execução. O motor não inventa insights para preencher a
          interface.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {insights.map((item, index) => (
            <li key={`${item.kind}-${item.claimId ?? index}`} className="rounded-lg bg-[#07111f] p-3">
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className={`mt-1 ${ni.muted}`}>{item.body}</p>
              {item.evidenceLevel ? (
                <p className="mt-2 text-[11px] uppercase tracking-wide text-[#7eb6ff]">
                  {item.evidenceLevel}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
