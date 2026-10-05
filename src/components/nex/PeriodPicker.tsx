import { format, startOfMonth, startOfWeek, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarRange } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MetaPeriod } from "@/lib/meta-access";

type ShortcutId =
  | "today"
  | "yesterday"
  | "last_7d"
  | "today_yesterday"
  | "last_14d"
  | "last_28d"
  | "last_30d"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month";

const shortcuts: { id: ShortcutId; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "last_7d", label: "Últimos 7 dias" },
  { id: "today_yesterday", label: "Hoje e ontem" },
  { id: "last_14d", label: "Últimos 14 dias" },
  { id: "last_28d", label: "Últimos 28 dias" },
  { id: "last_30d", label: "Últimos 30 dias" },
  { id: "this_week", label: "Esta semana" },
  { id: "last_week", label: "Semana passada" },
  { id: "this_month", label: "Este mês" },
  { id: "last_month", label: "Mês passado" },
];

function todayInSaoPaulo() {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function iso(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function fromIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return todayInSaoPaulo();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function rangeOf(id: ShortcutId, today: Date): DateRange {
  const yesterday = subDays(today, 1);
  if (id === "today") return { from: today, to: today };
  if (id === "yesterday") return { from: yesterday, to: yesterday };
  if (id === "today_yesterday") return { from: yesterday, to: today };
  if (id === "last_7d") return { from: subDays(yesterday, 6), to: yesterday };
  if (id === "last_14d") return { from: subDays(yesterday, 13), to: yesterday };
  if (id === "last_28d") return { from: subDays(yesterday, 27), to: yesterday };
  if (id === "last_30d") return { from: subDays(yesterday, 29), to: yesterday };
  if (id === "this_week") return { from: startOfWeek(today, { weekStartsOn: 1 }), to: today };
  if (id === "last_week") {
    const start = startOfWeek(subDays(today, 7), { weekStartsOn: 1 });
    return { from: start, to: subDays(start, -6) };
  }
  if (id === "this_month") return { from: startOfMonth(today), to: today };
  const previous = subMonths(startOfMonth(today), 1);
  return { from: previous, to: subDays(startOfMonth(today), 1) };
}

function matchingShortcut(range: DateRange | undefined, today: Date) {
  if (!range?.from || !range.to) return null;
  const since = iso(range.from);
  const until = iso(range.to);
  return shortcuts.find((item) => {
    const candidate = rangeOf(item.id, today);
    return candidate.from && candidate.to && iso(candidate.from) === since && iso(candidate.to) === until;
  });
}

function dayLabel(date: Date) {
  return format(date, "d 'de' MMM", { locale: ptBR }).replace(".", "");
}

function triggerLabel(period: MetaPeriod) {
  if (period.mode === "total") return "Total";
  return `Personalizado · ${dayLabel(fromIso(period.since))} – ${dayLabel(fromIso(period.until))}`;
}

export function PeriodPicker({
  value,
  disabled,
  onApply,
}: {
  value: MetaPeriod;
  disabled?: boolean;
  onApply: (period: MetaPeriod) => void;
}) {
  const today = todayInSaoPaulo();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"total" | "custom">(value.mode);
  const [range, setRange] = useState<DateRange | undefined>();
  const [month, setMonth] = useState<Date>(subMonths(today, 1));

  const openPanel = (next: boolean) => {
    if (next) {
      if (value.mode === "custom") {
        const selected = { from: fromIso(value.since), to: fromIso(value.until) };
        setMode("custom");
        setRange(selected);
        setMonth(selected.from ?? subMonths(today, 1));
      } else {
        setMode("total");
        setRange(undefined);
        setMonth(subMonths(today, 1));
      }
    }
    setOpen(next);
  };

  const chooseCustom = () => {
    setMode("custom");
    if (!range?.from || !range.to) {
      const selected = rangeOf("last_30d", today);
      setRange(selected);
      setMonth(selected.from ?? subMonths(today, 1));
    }
  };

  const chooseShortcut = (id: ShortcutId) => {
    const selected = rangeOf(id, today);
    setMode("custom");
    setRange(selected);
    if (selected.from) setMonth(selected.from);
  };

  const apply = () => {
    if (mode === "total") {
      onApply({ mode: "total" });
      setOpen(false);
      return;
    }
    if (!range?.from || !range.to) return;
    onApply({ mode: "custom", since: iso(range.from), until: iso(range.to) });
    setOpen(false);
  };

  const activeShortcut = matchingShortcut(range, today);

  return (
    <Popover open={open} onOpenChange={openPanel}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start bg-background sm:w-72" disabled={disabled}>
          <CalendarRange />
          {triggerLabel(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-[calc(100vw-1rem)] p-0">
        <div className="flex max-h-[min(40rem,calc(100vh-6rem))] flex-col overflow-auto lg:flex-row">
          <div className="w-full shrink-0 border-b p-3 lg:w-56 lg:border-b-0 lg:border-r">
            <p className="px-2 text-xs font-medium text-muted-foreground">Período</p>
            <div className="mt-2 space-y-1">
              <Choice checked={mode === "total"} label="Total" onSelect={() => setMode("total")} />
              <Choice checked={mode === "custom"} label="Personalizado" onSelect={chooseCustom} />
            </div>
            {mode === "custom" && (
              <div className="mt-4">
                <p className="px-2 text-xs font-medium text-muted-foreground">Usados recentemente</p>
                <div className="mt-2 max-h-64 space-y-1 overflow-auto">
                  {shortcuts.map((item) => (
                    <Choice
                      key={item.id}
                      checked={activeShortcut?.id === item.id}
                      label={item.label}
                      onSelect={() => chooseShortcut(item.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          {mode === "custom" && (
            <div className="min-w-0 p-3">
              <Calendar
                mode="range"
                locale={ptBR}
                weekStartsOn={1}
                captionLayout="dropdown"
                numberOfMonths={2}
                selected={range}
                onSelect={setRange}
                month={month}
                onMonthChange={setMonth}
                disabled={{ after: today }}
                startMonth={subMonths(today, 37)}
                endMonth={today}
              />
            </div>
          )}
          {mode === "total" && (
            <div className="flex min-h-40 flex-1 items-center p-6 text-sm text-muted-foreground lg:w-80">
              Exibe os indicadores de todo o período disponível, desde o início das campanhas.
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 border-t p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            {mode === "total" ? (
              <p className="font-medium">Total</p>
            ) : (
              <p>
                <span className="font-medium">{activeShortcut?.label ?? "Personalizado"}</span>
                {range?.from && range.to && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {dayLabel(range.from)} – {dayLabel(range.to)}
                  </span>
                )}
              </p>
            )}
            <p className="text-xs text-muted-foreground">Fuso horário das datas: Horário de São Paulo</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={apply} disabled={mode === "custom" && (!range?.from || !range.to)}>
              Atualizar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Choice({ checked, label, onSelect }: { checked: boolean; label: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
      aria-pressed={checked}
    >
      <span
        className={`grid size-4 place-items-center rounded-full border ${checked ? "border-primary" : "border-muted-foreground/50"}`}
      >
        {checked && <span className="size-2 rounded-full bg-primary" />}
      </span>
      {label}
    </button>
  );
}
