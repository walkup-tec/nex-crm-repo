/** Chaves de exibição que NÃO são eventos técnicos da Meta. */
const DISPLAY_ONLY_RESULT_LABELS = new Set([
  "conversoes",
  "conversões",
  "conversao",
  "conversão",
  "conversions",
  "results",
  "resultados",
]);

export function isTechnicalMetaResultEventKey(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const normalized = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (DISPLAY_ONLY_RESULT_LABELS.has(normalized)) return false;
  // Eventos Meta típicos: onsite_conversion.*, offsite_conversion.*, lead, etc.
  return /[._]/.test(trimmed) || /conversion|lead|messaging|purchase|complete/i.test(trimmed);
}

/**
 * Resolve a chave técnica do evento a partir de candidatos (objectives, campanhas).
 * Nunca retorna rótulos de UI como "Conversões".
 */
export function resolveTechnicalResultEventKey(
  candidates: Array<string | null | undefined>,
): string | undefined {
  for (const candidate of candidates) {
    if (isTechnicalMetaResultEventKey(candidate)) return candidate!.trim();
  }
  return undefined;
}
