import type { LucideIcon } from "lucide-react";
import {
  CircleDollarSign,
  Eye,
  FlaskConical,
  ImagePlus,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  PauseCircle,
  UsersRound,
} from "lucide-react";

export type TaskVisualType =
  | "audience"
  | "creative"
  | "placement"
  | "budget"
  | "pause"
  | "monitor"
  | "test"
  | "hypothesis"
  | "action";

/** Infere o tipo visual da tarefa a partir do título (e opcionalmente do kind). */
export function resolveTaskVisualType(
  title: string,
  kind?: "action" | "test" | "hypothesis" | "monitor",
): TaskVisualType {
  const text = title.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

  if (/(publico|segmenta|audiencia|lookalike|interesse)/.test(text)) {
    return "audience";
  }
  if (/(criativo|arte|copy|anuncio)/.test(text)) {
    return "creative";
  }
  if (/(posicionamento|placement|feed|stories|reels|canal)/.test(text)) {
    return "placement";
  }
  if (/(orcamento|budget|investimento|bid|lance)/.test(text)) {
    return "budget";
  }
  if (/(pausar|pause|desligar|desativar)/.test(text)) {
    return "pause";
  }
  if (/(monitor|acompanhar|observar)/.test(text) || kind === "monitor") {
    return "monitor";
  }
  if (kind === "test") return "test";
  if (kind === "hypothesis") return "hypothesis";
  return "action";
}

const ICONS: Record<TaskVisualType, LucideIcon> = {
  audience: UsersRound,
  creative: ImagePlus,
  placement: LayoutGrid,
  budget: CircleDollarSign,
  pause: PauseCircle,
  monitor: Eye,
  test: FlaskConical,
  hypothesis: Lightbulb,
  action: ListChecks,
};

export function taskTypeIcon(type: TaskVisualType): LucideIcon {
  return ICONS[type];
}

type Props = {
  title: string;
  kind?: "action" | "test" | "hypothesis" | "monitor";
  className?: string;
};

export function TaskTypeIcon({ title, kind, className = "size-4 shrink-0 text-[#3ecbff]" }: Props) {
  const type = resolveTaskVisualType(title, kind);
  const Icon = taskTypeIcon(type);
  return <Icon className={className} aria-hidden />;
}
