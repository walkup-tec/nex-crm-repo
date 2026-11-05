import { Brain } from "lucide-react";
import { ni } from "@/components/nex/intelligence/intelligence-theme";

type Props = {
  rightSlot?: React.ReactNode;
};

export function IntelligenceHeader({ rightSlot }: Props) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#1e3a5f]/70 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#122038] text-[#3ecbff]">
          <Brain className="size-5" />
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight text-white">NEX Intelligence</p>
          <p className={ni.muted}>Análise e otimização de campanhas</p>
        </div>
      </div>
      {rightSlot ? <div className="flex flex-wrap items-center gap-2">{rightSlot}</div> : null}
    </div>
  );
}
