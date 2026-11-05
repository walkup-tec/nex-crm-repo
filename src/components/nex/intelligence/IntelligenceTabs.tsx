import { CalendarDays, LineChart, SlidersHorizontal } from "lucide-react";
import { ni } from "@/components/nex/intelligence/intelligence-theme";

export type IntelligenceTabId = "daily" | "manual" | "evolution";

const TABS: Array<{ id: IntelligenceTabId; label: string; icon: typeof CalendarDays }> = [
  { id: "daily", label: "Análise diária", icon: CalendarDays },
  { id: "manual", label: "Análise manual", icon: SlidersHorizontal },
  { id: "evolution", label: "Evolução", icon: LineChart },
];

type Props = {
  value: IntelligenceTabId;
  onChange: (value: IntelligenceTabId) => void;
};

export function IntelligenceTabs({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 px-5 py-3">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
              active ? ni.tabActive : ni.tabIdle
            }`}
            onClick={() => onChange(tab.id)}
          >
            <Icon className="size-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
