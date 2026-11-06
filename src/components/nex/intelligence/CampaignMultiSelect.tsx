import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { campaignMark } from "@/lib/meta-analysis";
import type { MetaCampaignRow } from "@/lib/meta-access";
import type { CampaignOption } from "@/lib/nex-intelligence/dashboard/types";
import { ni } from "@/components/nex/intelligence/intelligence-theme";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function CampaignSignal({
  row,
}: {
  row: Pick<MetaCampaignRow, "status" | "statusGroup">;
}) {
  const mark = campaignMark(row);
  const tone = mark === "ativa" ? "bg-emerald-500" : mark === "erro" ? "bg-red-500" : "bg-zinc-400";
  const label =
    mark === "ativa" ? "Campanha ativa" : mark === "erro" ? "Campanha com erro" : "Campanha desativada";
  return <span className={`size-2 shrink-0 rounded-full ${tone}`} title={label} aria-label={label} />;
}

type Props = {
  campaigns: CampaignOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
};

export function CampaignMultiSelect({
  campaigns,
  selectedIds,
  onChange,
  disabled,
  loading,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const label = useMemo(() => {
    if (loading) return "Carregando campanhas…";
    if (!selectedIds.length) return "Todas (agregado verificável)";
    if (selectedIds.length === 1) {
      return campaigns.find((row) => row.id === selectedIds[0])?.name ?? "1 campanha";
    }
    return `${selectedIds.length} campanhas selecionadas`;
  }, [campaigns, loading, selectedIds]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((value) => value !== id));
      return;
    }
    onChange([...selectedIds, id]);
  };

  const clearAll = () => onChange([]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || loading}
          className={cn(
            ni.input,
            "inline-flex items-center justify-between gap-2 px-3 text-left disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          aria-label="Selecionar campanhas"
        >
          <span className="flex min-w-0 items-center gap-2">
            {selectedIds.length === 1 ? (
              (() => {
                const row = campaigns.find((item) => item.id === selectedIds[0]);
                return row?.statusGroup ? (
                  <CampaignSignal
                    row={{
                      status: row.status ?? row.statusGroup,
                      statusGroup: row.statusGroup,
                    }}
                  />
                ) : null;
              })()
            ) : null}
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(28rem,calc(100vw-2rem))] border-[#1e3a5f] bg-[#0b1729] p-0 text-[#f4f7fb]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#1e3a5f]/70 px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[#8fa3bf]">Campanhas</p>
          <button
            type="button"
            className="text-xs text-[#7eb6ff] hover:underline disabled:opacity-40"
            disabled={!selectedIds.length}
            onClick={clearAll}
          >
            Limpar (todas)
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-[#122038]",
              !selectedIds.length && "text-[#7eb6ff]",
            )}
            onClick={clearAll}
          >
            <span className="flex size-4 items-center justify-center">
              {!selectedIds.length ? <Check className="size-3.5" /> : null}
            </span>
            <span className="truncate">Todas (agregado verificável)</span>
          </button>
          {campaigns.length === 0 ? (
            <p className="px-3 py-4 text-sm text-[#8fa3bf]">Sem campanhas no período.</p>
          ) : (
            campaigns.map((campaign) => {
              const checked = selectedSet.has(campaign.id);
              const statusGroup = campaign.statusGroup ?? "Outro";
              const status = campaign.status ?? statusGroup;
              return (
                <label
                  key={campaign.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-[#122038]"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(campaign.id)}
                    className="border-[#3a5478] data-[state=checked]:bg-[#1d6feb] data-[state=checked]:border-[#1d6feb]"
                    aria-label={`Selecionar ${campaign.name}`}
                  />
                  <CampaignSignal row={{ status, statusGroup }} />
                  <span className="min-w-0 flex-1 truncate" title={campaign.name}>
                    {campaign.name}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
