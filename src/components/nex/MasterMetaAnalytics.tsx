import { Check, Copy, FlaskConical, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clientDisplayName, type ListedClient } from "@/lib/client-access";
import { listClientsFn } from "@/lib/clients.functions";
import type { MetaPeriod } from "@/lib/meta-access";
import {
  findRecentMetaAiDuplicate,
  type MetaAiAnalysisResult,
  type MetaAiCalibrationFeedback,
  type MetaAiExecutionDetail,
  type MetaAiExecutionSummary,
} from "@/lib/meta-ai-calibration";
import {
  analyzeMetaWithAiFn,
  getMetaAiExecutionFn,
  listMetaAiExecutionsFn,
  reviewMetaAiCalibrationWithAiFn,
  saveMetaAiCalibrationFeedbackFn,
} from "@/lib/meta.functions";

function periodRequest(period: MetaPeriod) {
  if (period.mode === "total") return { period: "total" as const };
  return { period: "custom" as const, since: period.since, until: period.until };
}

function periodLabel(since: string | null, until: string | null) {
  if (!since || !until) return "Todo o período";
  const br = (iso: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return iso;
    return `${match[3]}/${match[2]}/${match[1]}`;
  };
  return `${br(since)} – ${br(until)}`;
}

export function MasterMetaAnalytics() {
  const [clients, setClients] = useState<ListedClient[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [period, setPeriod] = useState<MetaPeriod>({ mode: "total" });
  const [loadingClients, setLoadingClients] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const analyzingLock = useRef(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const reviewingLock = useRef(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<MetaAiAnalysisResult | null>(null);
  const [executions, setExecutions] = useState<MetaAiExecutionSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<MetaAiExecutionDetail | null>(null);
  const [copiedId, setCopiedId] = useState("");
  const copiedTimer = useRef<number | null>(null);
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState({
    precision: "",
    consistency: "",
    foundation: "",
    limitations: "",
    applicability: "",
  });
  const [duplicateConfirm, setDuplicateConfirm] = useState<MetaAiExecutionSummary | null>(null);

  const copyExecutionId = (executionId: string) => {
    void navigator.clipboard.writeText(executionId).then(() => {
      setCopiedId(executionId);
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopiedId(""), 1500);
      setNotice("ID da execução copiado.");
    });
  };

  useEffect(() => {
    return () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === organizationId) ?? null,
    [clients, organizationId],
  );

  const loadExecutions = useCallback(async (orgId?: string) => {
    setLoadingList(true);
    const listed = await listMetaAiExecutionsFn({
      data: orgId ? { organizationId: orgId, limit: 40 } : { limit: 40 },
    });
    setLoadingList(false);
    if (!listed.ok) {
      setError(listed.message);
      return;
    }
    setExecutions(listed.data);
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoadingClients(true);
      const listed = await listClientsFn();
      if (!alive) return;
      setLoadingClients(false);
      if (!listed.ok) {
        setError(listed.message);
        return;
      }
      const rows = listed.data
        .filter((client) => client.adsMeta !== false)
        .sort((left, right) =>
          clientDisplayName(left).localeCompare(clientDisplayName(right), "pt-BR"),
        );
      setClients(rows);
      if (!organizationId && rows[0]) setOrganizationId(rows[0].id);
      await loadExecutions();
    })();
    return () => {
      alive = false;
    };
  }, [loadExecutions]);

  const openExecution = async (executionId: string) => {
    setSelectedId(executionId);
    setLoadingDetail(true);
    setError("");
    const response = await getMetaAiExecutionFn({ data: { executionId } });
    setLoadingDetail(false);
    if (!response.ok) {
      setError(response.message);
      return;
    }
    setDetail(response.data);
    setNotes(response.data.calibrationFeedback.notes ?? "");
    setScores({
      precision: response.data.calibrationFeedback.scores?.precision?.toString() ?? "",
      consistency: response.data.calibrationFeedback.scores?.consistency?.toString() ?? "",
      foundation: response.data.calibrationFeedback.scores?.foundation?.toString() ?? "",
      limitations: response.data.calibrationFeedback.scores?.limitations?.toString() ?? "",
      applicability: response.data.calibrationFeedback.scores?.applicability?.toString() ?? "",
    });
  };

  const executeAnalysis = async () => {
    if (!organizationId) {
      setError("Selecione um cliente.");
      return;
    }
    if (analyzingLock.current) {
      setNotice("Já existe uma análise em andamento. Aguarde a conclusão.");
      return;
    }
    analyzingLock.current = true;
    setAnalyzing(true);
    setError("");
    setNotice("Exportando Meta e consultando a OpenAI — isso pode levar até alguns minutos…");
    setResult(null);
    const orgId = organizationId;
    let executionId = "";
    try {
      const response = await Promise.race([
        analyzeMetaWithAiFn({
          data: { organizationId: orgId, ...periodRequest(period) },
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => {
            reject(new Error("A análise excedeu o tempo limite. Tente novamente em instantes."));
          }, 240000);
        }),
      ]);
      if (!response.ok) {
        setError(response.message);
        setNotice("");
        return;
      }
      executionId = response.data.executionId;
      setResult(response.data);
      setNotice("Análise concluída e registrada para calibração.");
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      setError(
        /page\s+not\s+found|^404\b/i.test(raw)
          ? "Rota do servidor não encontrada (404). Confirme o deploy ( /health → NEX-DEPLOY-METAI120 ) e OPENAI_API_URL."
          : raw || "Não foi possível concluir a análise.",
      );
      setNotice("");
      return;
    } finally {
      analyzingLock.current = false;
      setAnalyzing(false);
    }

    // Histórico/detalhe fora do lock de "Analisando…" — falha aqui não prende o botão.
    try {
      await loadExecutions(orgId);
      if (executionId) await openExecution(executionId);
    } catch {
      setNotice(
        executionId
          ? `Análise concluída (${executionId}), mas o histórico não atualizou. Use Atualizar histórico.`
          : "Análise concluída, mas o histórico não atualizou. Use Atualizar histórico.",
      );
    }
  };

  const runAnalysis = () => {
    if (!organizationId) {
      setError("Selecione um cliente.");
      return;
    }
    if (analyzingLock.current || analyzing) {
      setNotice("Já existe uma análise em andamento. Aguarde a conclusão.");
      return;
    }
    const duplicate = findRecentMetaAiDuplicate(executions, { organizationId, period });
    if (duplicate) {
      setDuplicateConfirm(duplicate);
      setError("");
      setNotice("");
      return;
    }
    void executeAnalysis();
  };

  const cancelDuplicateConfirm = () => {
    const duplicate = duplicateConfirm;
    setDuplicateConfirm(null);
    if (!duplicate) return;
    setNotice("Execução cancelada — use o histórico à esquerda ou confirme para rodar de novo.");
    setSelectedId(duplicate.id);
    void openExecution(duplicate.id);
  };

  const confirmDuplicateAndRun = () => {
    setDuplicateConfirm(null);
    // Próximo tick: evita conflito com o fechamento do AlertDialog.
    window.setTimeout(() => {
      void executeAnalysis();
    }, 0);
  };

  const reviewCalibration = async () => {
    if (!selectedId || reviewingLock.current) return;
    reviewingLock.current = true;
    setReviewing(true);
    setError("");
    setNotice("");
    try {
      const response = await reviewMetaAiCalibrationWithAiFn({ data: { executionId: selectedId } });
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setDetail(response.data);
      setNotice("Revisão de calibração concluída direto na OpenAI.");
    } finally {
      reviewingLock.current = false;
      setReviewing(false);
    }
  };

  const saveFeedback = async () => {
    if (!selectedId) return;
    setSavingFeedback(true);
    setError("");
    const feedback: MetaAiCalibrationFeedback = {
      ...detail?.calibrationFeedback,
      notes: notes.trim() || undefined,
      scores: {
        precision: scores.precision === "" ? null : Number(scores.precision),
        consistency: scores.consistency === "" ? null : Number(scores.consistency),
        foundation: scores.foundation === "" ? null : Number(scores.foundation),
        limitations: scores.limitations === "" ? null : Number(scores.limitations),
        applicability: scores.applicability === "" ? null : Number(scores.applicability),
      },
      reviewer: "master",
    };
    const response = await saveMetaAiCalibrationFeedbackFn({
      data: { executionId: selectedId, feedback },
    });
    setSavingFeedback(false);
    if (!response.ok) {
      setError(response.message);
      return;
    }
    setDetail(response.data);
    setNotice("Avaliação de calibração salva.");
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="size-5 text-primary" />
            NEX Intelligence — Laboratório de Calibração
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Envia os dados Meta para a OpenAI, registra a execução com UUID e permite consulta pelo
            ChatGPT Actions (`get_meta_analysis_execution`). Só Master.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <label className="grid w-full gap-2 text-sm lg:max-w-md">
              Cliente
              <Select
                value={organizationId}
                onValueChange={(value) => {
                  setOrganizationId(value);
                  setResult(null);
                  void loadExecutions(value);
                }}
                disabled={loadingClients || analyzing}
              >
                <SelectTrigger aria-label="Selecionar cliente">
                  <SelectValue placeholder={loadingClients ? "Carregando..." : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {clientDisplayName(client)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <PeriodPicker value={period} disabled={analyzing} onApply={setPeriod} />
          </div>

          {selectedClient ? (
            <p className="text-sm text-muted-foreground">
              Conta Meta:{" "}
              <span className="font-medium text-foreground">
                {selectedClient.metaAccounts?.[0]?.id?.replace(/^act_/i, "") ||
                  selectedClient.adAccountIds?.[0]?.replace(/^act_/i, "") ||
                  "não selecionada"}
              </span>
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={runAnalysis}
              disabled={analyzing || !organizationId || loadingClients}
            >
              <Sparkles className="size-4" />
              {analyzing ? "Analisando..." : "Executar análise IA"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadExecutions(organizationId || undefined)}
              disabled={loadingList}
            >
              <RefreshCw className="size-4" />
              Atualizar histórico
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
          {result ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Última execução</span>
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                {result.executionId}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2"
                aria-label="Copiar ID da execução"
                onClick={() => copyExecutionId(result.executionId)}
              >
                {copiedId === result.executionId ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copiedId === result.executionId ? "Copiado" : "Copiar ID"}
              </Button>
              <span>
                · protocolo {result.protocolVersion} · prompt {result.promptHash} · modelo{" "}
                {result.model}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Execuções</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingList ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
            {!loadingList && executions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma execução registrada.</p>
            ) : null}
            <div className="max-h-[28rem] space-y-2 overflow-y-auto">
              {executions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openExecution(item.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition hover:bg-muted/40 ${
                    selectedId === item.id ? "border-primary bg-muted/50" : ""
                  }`}
                >
                  <p className="font-medium">{item.clientName || "Cliente"}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{item.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("pt-BR")} · {item.status} · v
                    {item.protocolVersion}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {periodLabel(item.periodSince, item.periodUntil)}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Detalhe da execução</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedId || reviewing || !detail?.analysisMarkdown}
                onClick={() => void reviewCalibration()}
              >
                <Sparkles className="size-4" />
                {reviewing ? "Revisando na OpenAI..." : "Revisar calibração na OpenAI"}
              </Button>
            </div>
            {detail ? (
              <p className="text-sm text-muted-foreground">
                {detail.clientName} · {detail.accountName} ·{" "}
                {periodLabel(detail.periodSince, detail.periodUntil)} · {detail.model}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione uma execução para ver o diagnóstico e pedir revisão na OpenAI.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingDetail ? <p className="text-sm text-muted-foreground">Carregando detalhe...</p> : null}
            {detail ? (
              <>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                  <span className="text-xs font-medium text-muted-foreground">ID da execução</span>
                  <code className="break-all font-mono text-sm text-foreground">{detail.id}</code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    aria-label="Copiar ID da execução"
                    onClick={() => copyExecutionId(detail.id)}
                  >
                    {copiedId === detail.id ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copiedId === detail.id ? "Copiado" : "Copiar ID"}
                  </Button>
                </div>
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>Status: {detail.status}</p>
                  <p>Protocolo: {detail.protocolVersion}</p>
                  <p>Contrato: {detail.dataContractVersion}</p>
                  <p>Prompt hash: {detail.promptHash}</p>
                  <p>Avisos: {detail.warnings.length}</p>
                </div>
                {detail.warnings.length ? (
                  <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                    {detail.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                ) : null}
                {detail.errorMessage ? (
                  <p className="text-sm text-destructive">{detail.errorMessage}</p>
                ) : null}
                <div className="whitespace-pre-wrap rounded-lg border p-4 text-sm leading-6">
                  {detail.analysisMarkdown || "Sem análise."}
                </div>

                {detail.calibrationFeedback.ai_review ? (
                  <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <p className="text-sm font-medium">
                      Revisão OpenAI
                      {detail.calibrationFeedback.ai_review_model
                        ? ` · ${detail.calibrationFeedback.ai_review_model}`
                        : ""}
                    </p>
                    <div className="whitespace-pre-wrap text-sm leading-6">
                      {detail.calibrationFeedback.ai_review}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3 rounded-lg border p-4">
                  <p className="text-sm font-medium">Avaliação manual de calibração (0–5)</p>
                  <div className="grid gap-2 sm:grid-cols-5">
                    {(
                      [
                        ["precision", "Precisão"],
                        ["consistency", "Consistência"],
                        ["foundation", "Fundamento"],
                        ["limitations", "Limitações"],
                        ["applicability", "Aplicabilidade"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="grid gap-1 text-xs">
                        {label}
                        <Input
                          inputMode="numeric"
                          value={scores[key]}
                          onChange={(event) =>
                            setScores((current) => ({ ...current, [key]: event.target.value }))
                          }
                          placeholder="0-5"
                        />
                      </label>
                    ))}
                  </div>
                  <label className="grid gap-1 text-sm">
                    Observações
                    <Input
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Notas da revisão no ChatGPT"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={savingFeedback}
                    onClick={() => void saveFeedback()}
                  >
                    {savingFeedback ? "Salvando..." : "Salvar avaliação"}
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={duplicateConfirm !== null}
        onOpenChange={(open) => {
          if (!open && !analyzing) setDuplicateConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Executar análise novamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe uma execução recente para este cliente e período
              {duplicateConfirm
                ? ` (${new Date(duplicateConfirm.createdAt).toLocaleString("pt-BR")})`
                : ""}
              . Confirme para enviar uma nova análise à OpenAI ou cancele para abrir a execução
              existente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={analyzing} onClick={cancelDuplicateConfirm}>
              Cancelar
            </AlertDialogCancel>
            <Button type="button" disabled={analyzing} onClick={confirmDuplicateAndRun}>
              Executar novamente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
