import { formatDateTime } from "@/lib/nex-intelligence/dashboard/format";
import type { OptimizationMarker } from "@/lib/nex-intelligence/dashboard/types";
import { ni } from "@/components/nex/intelligence/intelligence-theme";
import { TaskTypeIcon } from "@/components/nex/intelligence/task-type-icon";

type Props = {
  title?: string;
  items: OptimizationMarker[];
  loading?: boolean;
};

export function AppliedOptimizationsHistory({
  title = "Otimizações realizadas",
  items,
  loading = false,
}: Props) {
  const rows = [...items].sort(
    (a, b) => Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt),
  );

  return (
    <div className={`${ni.card} overflow-hidden`}>
      <div className="border-b border-[#1e3a5f]/70 px-4 py-3">
        <h3 className={ni.title}>{title}</h3>
        <p className={`mt-1 ${ni.muted}`}>
          Histórico das tarefas aplicadas neste cliente, da mais recente para a mais antiga.
        </p>
      </div>
      {loading ? (
        <p className={`px-4 py-6 ${ni.muted}`}>Carregando histórico…</p>
      ) : rows.length === 0 ? (
        <p className={`px-4 py-6 ${ni.muted}`}>
          Nenhuma otimização aplicada para este cliente ainda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-[#07111f] text-[#8fa3bf]">
              <tr>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Tarefa</th>
                <th className="px-4 py-2 font-medium">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-t border-[#1e3a5f]/50">
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-[#c5d3e6]">
                    {formatDateTime(item.effectiveAt)}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2.5">
                      <TaskTypeIcon
                        title={item.type}
                        className="size-[18px] shrink-0 stroke-[1.75] text-[#3ecbff]"
                      />
                      <span className="font-medium text-white">{item.type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle text-[#c5d3e6]">
                    {item.description || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
