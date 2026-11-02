import { Download, FlaskConical, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
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
import type {
  MetaAiAnalysisResult,
  MetaAiCalibrationFeedback,
  MetaAiExecutionDetail,
  MetaAiExecutionSummary,
} from "@/lib/meta-ai-calibration";
import {
  analyzeMetaWithAiFn,
  exportMetaAiCalibrationPackageFn,
  getMetaAiExecutionFn,
  listMetaAiExecutionsFn,
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

function downloadBase64(fileName: string, base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function MasterMetaAnalytics() {
  const [clients, setClients] = useState<ListedClient[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [period, setPeriod] = useState<MetaPeriod>({ mode: "total" });
  const [loadingClients, setLoadingClients] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<MetaAiAnalysisResult | null>(null);
  const [executions, setExecutions] = useState<MetaAiExecutionSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<MetaAiExecutionDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState({
    precision: "",
    consistency: "",
    foundation: "",
    limitations: "",
    applicability: "",
  });

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

  const runAnalysis = async () => {
    if (!organizationId) {
      setError("Selecione um cliente.");
      return;
    }
    setAnalyzing(true);
    setError("");
    setNotice("");
    setResult(null);
    const response = await analyzeMetaWithAiFn({
      data: { organizationId, ...periodRequest(period) },
    });
    setAnalyzing(false);
    if (!response.ok) {
      setError(response.message);
      await loadExecutions(organizationId);
      return;
    }
    setResult(response.data);
    setNotice("Análise concluída e registrada para calibração.");
    await loadExecutions(organizationId);
    await openExecution(response.data.executionId);
  };

  const exportPackage = async () => {
    if (!selectedId) return;
    setExporting(true);
    setError("");
    const response = await exportMetaAiCalibrationPackageFn({ data: { executionId: selectedId } });
    setExporting(false);
    if (!response.ok) {
      setError(response.message);
      return;
    }
    downloadBase64(response.data.fileName, response.data.base64, response.data.mimeType);
    setNotice("Pacote de calibração baixado. Envie o ZIP ao ChatGPT para revisão.");
  };

  const saveFeedback = async () => {
    if (!selectedId) return;
    setSavingFeedback(true);
    setError("");
    const feedback: MetaAiCalibrationFeedback = {
      notes: notes.trim() || undefined,
      scores: {
        precision: scores.precision === "" ? null : Number(scores.precision),
        consistency: scores.consistency === "" ? null : Number(scores.consistency),
        foundation: scores.foundation === "" ? null : Number(scores.foundation),
        limitations: scores.limitations === "" ? null : Number(scores.limitations),
        applicability: scores.applicability === "" ? null : Number(scores.applicability),
      },
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
            Executa análises reais de leads Meta, registra versões e exporta o pacote para revisão
            no ChatGPT. Só Master.
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
              onClick={() => void runAnalysis()}
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
            <p className="text-xs text-muted-foreground">
              Última execução {result.executionId.slice(0, 8)} · protocolo {result.protocolVersion} ·
              prompt {result.promptHash} · modelo {result.model}
            </p>
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
                disabled={!selectedId || exporting}
                onClick={() => void exportPackage()}
              >
                <Download className="size-4" />
                {exporting ? "Gerando ZIP..." : "Exportar Pacote de Calibração IA"}
              </Button>
            </div>
            {detail ? (
              <p className="text-sm text-muted-foreground">
                {detail.clientName} · {detail.accountName} ·{" "}
                {periodLabel(detail.periodSince, detail.periodUntil)} · {detail.model}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione uma execução para ver o diagnóstico e exportar o pacote.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingDetail ? <p className="text-sm text-muted-foreground">Carregando detalhe...</p> : null}
            {detail ? (
              <>
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>ID: {detail.id}</p>
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

                <div className="space-y-3 rounded-lg border p-4">
                  <p className="text-sm font-medium">Avaliação de calibração (0–5)</p>
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
    </div>
  );
}
