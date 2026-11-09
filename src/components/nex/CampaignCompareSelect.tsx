import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { campaignMark } from "@/lib/meta-analysis";
import type { MetaCampaignRow } from "@/lib/meta-access";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function CampaignSignal({ row }: { row: Pick<MetaCampaignRow, "status" | "statusGroup"> }) {
  const mark = campaignMark(row);
  const tone = mark === "ativa" ? "bg-emerald-500" : mark === "erro" ? "bg-red-500" : "bg-zinc-400";
  const label =
    mark === "ativa" ? "Campanha ativa" : mark === "erro" ? "Campanha com erro" : "Campanha inativa";
  return <span className={`size-2 shrink-0 rounded-full ${tone}`} title={label} aria-label={label} />;
}

function sortCompareCampaigns(rows: MetaCampaignRow[]) {
  return [...rows].sort((left, right) => {
    const leftActive = campaignMark(left) === "ativa" ? 0 : 1;
    const rightActive = campaignMark(right) === "ativa" ? 0 : 1;
    return leftActive - rightActive || left.name.localeCompare(right.name, "pt-BR");
  });
}

export function defaultCompareCampaignIds(rows: MetaCampaignRow[]) {
  const active = rows.filter((row) => campaignMark(row) === "ativa").map((row) => row.id);
  if (active.length >= 2) return active;
  return rows.map((row) => row.id);
}

type Props = {
  campaigns: MetaCampaignRow[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  className?: string;
};

export function CampaignCompareSelect({
  campaigns,
  selectedIds,
  onChange,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const ordered = useMemo(() => sortCompareCampaigns(campaigns), [campaigns]);

  const label = useMemo(() => {
    if (!selectedIds.length) return "Selecione campanhas";
    if (selectedIds.length === 1) {
      return ordered.find((row) => row.id === selectedIds[0])?.name ?? "1 campanha";
    }
    if (selectedIds.length === ordered.length) return `Todas (${selectedIds.length})`;
    return `${selectedIds.length} campanhas selecionadas`;
  }, [ordered, selectedIds]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((value) => value !== id));
      return;
    }
    onChange([...selectedIds, id]);
  };

  const selectAll = () => onChange(ordered.map((row) => row.id));
  const selectActives = () =>
    onChange(ordered.filter((row) => campaignMark(row) === "ativa").map((row) => row.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || ordered.length === 0}
          className={cn(
            "inline-flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50 sm:w-72",
            className,
          )}
          aria-label="Selecionar campanhas para comparar"
        >
          <span className="flex min-w-0 items-center gap-2">
            {selectedIds.length === 1
              ? (() => {
                  const row = ordered.find((item) => item.id === selectedIds[0]);
                  return row ? <CampaignSignal row={row} /> : null;
                })()
              : null}
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(28rem,calc(100vw-2rem))] p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Campanhas
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-xs text-primary hover:underline disabled:opacity-40"
              disabled={ordered.every((row) => campaignMark(row) !== "ativa")}
              onClick={selectActives}
            >
              Só ativas
            </button>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={selectAll}
            >
              Todas
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 border-b px-3 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
            Ativa
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-zinc-400" aria-hidden />
            Inativa
          </span>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {ordered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">Sem campanhas no período.</p>
          ) : (
            ordered.map((campaign) => {
              const checked = selectedSet.has(campaign.id);
              return (
                <label
                  key={campaign.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(campaign.id)}
                    aria-label={`Selecionar ${campaign.name}`}
                  />
                  <CampaignSignal row={campaign} />
                  <span className="min-w-0 flex-1 truncate" title={campaign.name}>
                    {campaign.name}
                  </span>
                  {checked ? <Check className="size-3.5 shrink-0 text-primary" aria-hidden /> : null}
                </label>
              );
            })
          )}
        </div>
        {selectedIds.length > 0 && selectedIds.length < 2 ? (
          <p className="border-t px-3 py-2 text-xs text-warning">
            Selecione pelo menos 2 campanhas para comparar.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
