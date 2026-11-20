/** Rótulos e cores (verde / amarelo / vermelho) dos status do módulo Candidatura. */

export type CareerTone = "green" | "yellow" | "red";

const TONE_CLASS: Record<CareerTone, string> = {
  green:
    "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  yellow:
    "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300",
  red: "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300",
};

const STATUS_LABEL: Record<string, string> = {
  // empresa (prospect)
  new: "Nova",
  researching: "Em pesquisa",
  contacted: "Contatada",
  qualified: "Qualificada",
  archived: "Arquivada",
  no_fit: "Sem perfil",
  // vaga (opportunity)
  prepared: "Preparada",
  // candidatura
  ready: "Pronta",
  approved: "Aprovada",
  sent: "Enviada",
  rejected: "Recusada",
  // execução / histórico
  running: "Em andamento",
  completed: "Concluída",
  partial: "Parcial",
  error: "Erro",
  // contato
  unverified: "Não verificado",
  verified: "Verificado",
  confirmed: "Confirmado",
  not_found: "Não encontrado",
  invalid: "Inválido",
  // enriquecimento
  none: "Sem enriquecimento",
  partial: "Parcial",
  complete: "Completo",
};

const STATUS_TONE: Record<string, CareerTone> = {
  // verde — progresso positivo / sucesso
  qualified: "green",
  prepared: "green",
  approved: "green",
  sent: "green",
  completed: "green",
  verified: "green",
  confirmed: "green",
  complete: "green",
  contacted: "green",
  // amarelo — aguardando ação / em curso
  new: "yellow",
  researching: "yellow",
  ready: "yellow",
  running: "yellow",
  partial: "yellow",
  unverified: "yellow",
  none: "yellow",
  // vermelho — bloqueio / falha / descartado
  archived: "red",
  no_fit: "red",
  error: "red",
  rejected: "red",
  invalid: "red",
  not_found: "red",
};

const KIND_LABEL: Record<string, string> = {
  companies_discover: "Descoberta de empresas",
  companies_import: "Importação de empresas",
  companies_enrich: "Enriquecimento de contatos",
  jobs_search: "Busca de vagas",
  application_prepare: "Preparação de candidatura",
  application_send: "Envio de candidatura",
};

const ACTOR_LABEL: Record<string, string> = {
  plugin: "Plugin",
  panel: "Painel",
  system: "Sistema",
};

export function careerStatusToneClass(tone: CareerTone) {
  return TONE_CLASS[tone];
}

export function careerStatusLabel(raw: string | null | undefined) {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return "—";
  return STATUS_LABEL[key] ?? key;
}

export function careerStatusTone(raw: string | null | undefined): CareerTone {
  const key = String(raw ?? "").trim().toLowerCase();
  return STATUS_TONE[key] ?? "yellow";
}

export function careerKindLabel(raw: string | null | undefined) {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return "—";
  return KIND_LABEL[key] ?? key;
}

export function careerActorLabel(raw: string | null | undefined) {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return "—";
  return ACTOR_LABEL[key] ?? key;
}
