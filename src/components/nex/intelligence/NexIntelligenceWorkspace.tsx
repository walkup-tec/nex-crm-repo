import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { listClientsFn } from "@/lib/clients.functions";
import { clientDisplayName, type ListedClient } from "@/lib/client-access";
import {
  META_AI_POLL_INTERVAL_MS,
  META_AI_POLL_MAX_MS,
  findRecentMetaAiDuplicate,
  isMetaAiExecutionTerminal,
  type MetaAiCalibrationFeedback,
  type MetaAiExecutionDetail,
  type MetaAiExecutionSummary,
} from "@/lib/meta-ai-calibration";
import {
  analyzeMetaWithAiFn,
  decideIntelligenceTaskFn,
  getMetaAiExecutionFn,
  getMetaPerformanceFn,
  listIntelligenceEventsFn,
  listMetaAiExecutionsFn,
  reprocessIntelligenceDailyFn,
  reviewMetaAiCalibrationWithAiFn,
  saveMetaAiCalibrationFeedbackFn,
  sendIntelligenceClientWhatsappFn,
  syncIntelligenceTasksFn,
} from "@/lib/meta.functions";
import type { MetaPeriod } from "@/lib/meta-access";
import {
  buildPeriodOverPeriodComparison,
  fillDailySeriesGaps,
  mapExecutionToDashboard,
  seriesFromMetaDays,
  totalsFromCounts,
} from "@/lib/nex-intelligence/dashboard/map-execution-to-dashboard";
import { formatShortDate } from "@/lib/nex-intelligence/dashboard/format";
import type {
  CampaignOption,
  DailySeriesPoint,
  MetricComparison,
  OptimizationMarker,
  SuggestedTask,
} from "@/lib/nex-intelligence/dashboard/types";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
import { MetricCard } from "@/components/nex/intelligence/MetricCard";
import { PerformanceChart } from "@/components/nex/intelligence/PerformanceChart";
import { OptimizationTaskList } from "@/components/nex/intelligence/OptimizationTaskList";
import { ClientCommunicationComposer } from "@/components/nex/intelligence/ClientCommunicationComposer";
import { InsightsPanel } from "@/components/nex/intelligence/InsightsPanel";
import { ComparisonBars } from "@/components/nex/intelligence/ComparisonBars";
import { CampaignMultiSelect } from "@/components/nex/intelligence/CampaignMultiSelect";
import { ManualAnalysisOverview } from "@/components/nex/intelligence/ManualAnalysisOverview";
import { AppliedOptimizationsHistory } from "@/components/nex/intelligence/AppliedOptimizationsHistory";
import { IntelligenceHeader } from "@/components/nex/intelligence/IntelligenceHeader";
import {
  IntelligenceTabs,
  type IntelligenceTabId,
} from "@/components/nex/intelligence/IntelligenceTabs";
import { ni } from "@/components/nex/intelligence/intelligence-theme";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function periodRequest(period: MetaPeriod) {
  if (period.mode === "total") return { period: "total" as const };
  return { period: "custom" as const, since: period.since, until: period.until };
}

function todayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysAgoIso(days: number) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function NexIntelligenceWorkspace() {
  const [tab, setTab] = useState<IntelligenceTabId>("daily");
  const [clients, setClients] = useState<ListedClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [organizationId, setOrganizationId] = useState("");
  const [campaignIds, setCampaignIds] = useState<string[]>([]);
  const [availableCampaigns, setAvailableCampaigns] = useState<CampaignOption[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [analysisDate, setAnalysisDate] = useState(todayIsoDate());
  const [period, setPeriod] = useState<MetaPeriod>({
    mode: "custom",
    since: daysAgoIso(6),
    until: daysAgoIso(0),
  });
  const [executions, setExecutions] = useState<MetaAiExecutionSummary[]>([]);
  const [detail, setDetail] = useState<MetaAiExecutionDetail | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [duplicateConfirm, setDuplicateConfirm] = useState<MetaAiExecutionSummary | null>(null);
  const [persistedTasks, setPersistedTasks] = useState<SuggestedTask[] | null>(null);
  const [markers, setMarkers] = useState<OptimizationMarker[]>([]);
  const [appliedHistory, setAppliedHistory] = useState<OptimizationMarker[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [periodComparisons, setPeriodComparisons] = useState<MetricComparison[]>([]);
  const [liveSeries, setLiveSeries] = useState<DailySeriesPoint[]>([]);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState({
    precision: "",
    consistency: "",
    foundation: "",
    limitations: "",
    applicability: "",
  });
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reprocessingDaily, setReprocessingDaily] = useState(false);
  const analyzingLock = useRef(false);
  const reviewingLock = useRef(false);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === organizationId) ?? null,
    [clients, organizationId],
  );

  const dashboard = useMemo(() => {
    const mapped = mapExecutionToDashboard(detail, { campaignIds });
    const series =
      liveSeries.length > 0
        ? liveSeries
        : fillDailySeriesGaps(mapped.series, mapped.periodStart, mapped.periodEnd);
    return {
      ...mapped,
      series,
      markers: markers.length ? markers : mapped.markers,
    };
  }, [detail, campaignIds, markers, liveSeries]);

  const tasks = persistedTasks ?? dashboard.tasks;
  const activeComparisons =
    periodComparisons.length > 0 ? periodComparisons : dashboard.comparisons;

  const mapEventRows = useCallback((rows: Array<Record<string, unknown>>): OptimizationMarker[] => {
    return rows.map((row) => ({
      id: String(row.id),
      entityId: String(row.campaign_id || row.adset_id || row.ad_id || ""),
      entityLevel: row.ad_id
        ? "ad"
        : row.adset_id
          ? "adset"
          : row.campaign_id
            ? "campaign"
            : "account",
      effectiveAt: String(row.effective_at),
      type: String(row.event_type || "otimização"),
      description: String(row.description || ""),
      responsibleUserId: row.responsible_user_id ? String(row.responsible_user_id) : null,
      responsibleName: null,
      communicationStatus: "none",
    }));
  }, []);

  const loadAppliedHistory = useCallback(
    async (orgId: string) => {
      if (!orgId) {
        setAppliedHistory([]);
        return;
      }
      setLoadingHistory(true);
      const events = await listIntelligenceEventsFn({
        data: { organizationId: orgId, limit: 100 },
      });
      setLoadingHistory(false);
      if (events.ok) {
        setAppliedHistory(mapEventRows(events.data as Array<Record<string, unknown>>));
      } else {
        setAppliedHistory([]);
      }
    },
    [mapEventRows],
  );

  const loadPeriodComparisons = useCallback(
    async (orgId: string, selectedPeriod: MetaPeriod, selectedCampaignIds: string[]) => {
      if (!orgId || selectedPeriod.mode === "total") {
        setPeriodComparisons([]);
        setLiveSeries([]);
        return;
      }
      const response = await getMetaPerformanceFn({
        data: { organizationId: orgId, ...periodRequest(selectedPeriod) },
      });
      if (!response.ok) {
        setPeriodComparisons([]);
        setLiveSeries([]);
        return;
      }

      const metaSeries = seriesFromMetaDays(response.data.days ?? [], selectedCampaignIds);
      setLiveSeries(
        metaSeries.length > 0
          ? fillDailySeriesGaps(metaSeries, selectedPeriod.since, selectedPeriod.until)
          : [],
      );

      if (!response.data.previousReady || !response.data.kpis || !response.data.previous) {
        setPeriodComparisons([]);
        return;
      }

      const selected = new Set(selectedCampaignIds);
      const currentRows =
        selected.size > 0
          ? response.data.campaigns.filter((row) => selected.has(row.id))
          : response.data.campaigns;
      const previousRows =
        selected.size > 0
          ? response.data.previousCampaigns.filter((row) => selected.has(row.id))
          : response.data.previousCampaigns;

      const sum = (rows: Array<{ results: number; spend: number; clicks: number; impressions: number; reach?: number }>) =>
        rows.reduce(
          (acc, row) => ({
            results: acc.results + row.results,
            spend: acc.spend + row.spend,
            clicks: acc.clicks + row.clicks,
            impressions: acc.impressions + row.impressions,
            reach: acc.reach + (row.reach ?? 0),
          }),
          { results: 0, spend: 0, clicks: 0, impressions: 0, reach: 0 },
        );

      const currentTotals =
        currentRows.length > 0
          ? totalsFromCounts(sum(currentRows))
          : totalsFromCounts({
              results: response.data.kpis.results,
              spend: response.data.kpis.spend,
              clicks: response.data.kpis.clicks,
              impressions: response.data.kpis.impressions,
              reach: response.data.kpis.reach,
            });
      const previousTotals =
        previousRows.length > 0
          ? totalsFromCounts(sum(previousRows))
          : totalsFromCounts({
              results: response.data.previous.results,
              spend: response.data.previous.spend,
              clicks: response.data.previous.clicks,
              impressions: response.data.previous.impressions,
              reach: response.data.previous.reach,
            });

      setPeriodComparisons(
        buildPeriodOverPeriodComparison(
          currentTotals,
          previousTotals,
          selectedPeriod.since,
          selectedPeriod.until,
          null,
        ),
      );
    },
    [],
  );

  const hydrateOps = useCallback(
    async (
      nextDetail: MetaAiExecutionDetail,
      mappedTasks: SuggestedTask[],
      selectedCampaignId?: string,
    ) => {
      const synced = await syncIntelligenceTasksFn({
        data: {
          executionId: nextDetail.id,
          organizationId: nextDetail.organizationId,
          adAccountId: nextDetail.accountId,
          tasks: mappedTasks,
        },
      });
      if (synced.ok) {
        setPersistedTasks(synced.data);
      } else {
        setPersistedTasks(null);
        if (!/0052_nex_intelligence/i.test(synced.message)) {
          setError(synced.message);
        } else {
          setNotice(synced.message);
        }
      }

      const events = await listIntelligenceEventsFn({
        data: {
          organizationId: nextDetail.organizationId,
          campaignId: selectedCampaignId || undefined,
          limit: 30,
        },
      });
      if (events.ok) {
        setMarkers(mapEventRows(events.data as Array<Record<string, unknown>>));
      } else {
        setMarkers([]);
      }
      await loadAppliedHistory(nextDetail.organizationId);
    },
    [loadAppliedHistory, mapEventRows],
  );

  const loadExecutions = useCallback(async (orgId?: string) => {
    setLoadingList(true);
    const listed = await listMetaAiExecutionsFn({
      data: { organizationId: orgId || undefined, limit: 40 },
    });
    setLoadingList(false);
    if (!listed.ok) {
      setError(listed.message);
      return;
    }
    setExecutions(listed.data);
  }, []);

  const loadCampaignsForClient = useCallback(
    async (orgId: string, selectedPeriod: MetaPeriod) => {
      if (!orgId) {
        setAvailableCampaigns([]);
        return;
      }
      setLoadingCampaigns(true);
      const response = await getMetaPerformanceFn({
        data: { organizationId: orgId, ...periodRequest(selectedPeriod) },
      });
      setLoadingCampaigns(false);
      if (!response.ok) {
        setAvailableCampaigns([]);
        setNotice(response.message);
        return;
      }
      const rows: CampaignOption[] = (response.data.campaigns ?? []).map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        objective: null,
        resultMetric: campaign.resultLabel || null,
        status: campaign.status,
        statusGroup: campaign.statusGroup,
      }));
      setAvailableCampaigns(rows);
      if (!rows.length) {
        setNotice("Nenhuma campanha retornada pela Meta para este cliente/período.");
      }
    },
    [],
  );

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
      const initialOrg = organizationId || rows[0]?.id || "";
      if (!organizationId && rows[0]) setOrganizationId(rows[0].id);
      await loadExecutions(initialOrg || undefined);
      if (initialOrg) {
        await loadCampaignsForClient(initialOrg, period);
        await loadAppliedHistory(initialOrg);
        await loadPeriodComparisons(initialOrg, period, []);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadExecutions, loadCampaignsForClient, loadAppliedHistory, loadPeriodComparisons]);

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
    setPersistedTasks(null);
    setNotes(response.data.calibrationFeedback.notes ?? "");
    setScores({
      precision: response.data.calibrationFeedback.scores?.precision?.toString() ?? "",
      consistency: response.data.calibrationFeedback.scores?.consistency?.toString() ?? "",
      foundation: response.data.calibrationFeedback.scores?.foundation?.toString() ?? "",
      limitations: response.data.calibrationFeedback.scores?.limitations?.toString() ?? "",
      applicability: response.data.calibrationFeedback.scores?.applicability?.toString() ?? "",
    });
    const mapped = mapExecutionToDashboard(response.data, { campaignIds });
    await hydrateOps(
      response.data,
      mapped.tasks,
      campaignIds.length === 1 ? campaignIds[0] : undefined,
    );
    if (response.data.organizationId) {
      await loadPeriodComparisons(response.data.organizationId, period, campaignIds);
    }
  };

  const pickExecutionForDaily = useCallback(async () => {
    if (!organizationId) {
      setError("Selecione um cliente.");
      return;
    }
    setNotice("Consultando execução publicada…");
    setError("");
    await loadExecutions(organizationId);
    const listed = await listMetaAiExecutionsFn({
      data: { organizationId, limit: 40 },
    });
    if (!listed.ok) {
      setError(listed.message);
      setNotice("");
      return;
    }
    const match =
      listed.data.find(
        (row) =>
          row.organizationId === organizationId &&
          (row.periodUntil === analysisDate || row.periodSince === analysisDate) &&
          (row.status === "ok" || row.status === "partial"),
      ) ??
      listed.data.find(
        (row) =>
          row.organizationId === organizationId &&
          (row.status === "ok" || row.status === "partial"),
      );
    if (!match) {
      setDetail(null);
      setNotice("Nenhuma análise diária disponível para a data/cliente. A rotina agendada ainda não está ligada.");
      return;
    }
    setNotice(`Carregando execução ${match.id}…`);
    await openExecution(match.id);
    setNotice("Análise carregada (consulta — sem reprocessar).");
  }, [organizationId, analysisDate, loadExecutions]);

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
    setNotice("Iniciando análise — export Meta e pipeline NEX Intelligence…");
    const orgId = organizationId;
    let executionId = "";
    try {
      const started = await analyzeMetaWithAiFn({
        data: { organizationId: orgId, ...periodRequest(period) },
      });
      if (!started.ok) {
        setError(started.message);
        setNotice("");
        return;
      }
      executionId = started.data.executionId;
      setSelectedId(executionId);
      setNotice(`Execução ${executionId} em andamento…`);
      await loadExecutions(orgId);

      const deadline = Date.now() + META_AI_POLL_MAX_MS;
      let nextDetail: MetaAiExecutionDetail | null = null;
      while (Date.now() < deadline) {
        const polled = await getMetaAiExecutionFn({ data: { executionId } });
        if (!polled.ok) {
          setError(polled.message);
          setNotice("");
          return;
        }
        nextDetail = polled.data;
        setDetail(nextDetail);
        if (isMetaAiExecutionTerminal(nextDetail.status)) break;
        setNotice(`Execução ${executionId} (${nextDetail.status})…`);
        await new Promise((resolve) => window.setTimeout(resolve, META_AI_POLL_INTERVAL_MS));
      }

      if (!nextDetail || !isMetaAiExecutionTerminal(nextDetail.status)) {
        setError(`A análise ainda está em andamento (${executionId}).`);
        setNotice("");
        return;
      }
      if (nextDetail.status === "error") {
        setError(nextDetail.errorMessage || "A análise falhou.");
        setNotice("");
        await loadExecutions(orgId);
        return;
      }
      setNotice("Análise concluída e publicada para calibração.");
      await loadExecutions(orgId);
      await openExecution(executionId);
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : "";
      setError(raw || "Não foi possível concluir a análise.");
      setNotice(
        executionId
          ? `Se a execução ${executionId} ficou em running, atualize o histórico em alguns minutos.`
          : "",
      );
    } finally {
      analyzingLock.current = false;
      setAnalyzing(false);
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

  const onApplyTask = async (task: SuggestedTask) => {
    setBusyTaskId(task.id);
    setError("");
    const response = await decideIntelligenceTaskFn({
      data: {
        taskId: task.id,
        decision: "APPLIED",
        description: task.justification || task.title,
        effectiveAt: new Date().toISOString(),
      },
    });
    setBusyTaskId(null);
    if (!response.ok) {
      setError(response.message);
      setNotice(
        /0052_nex_intelligence/i.test(response.message)
          ? response.message
          : "Não foi possível aplicar a tarefa.",
      );
      return;
    }
    const appliedTask = {
      ...response.data.task,
      status: "APPLIED" as const,
      appliedAt: response.data.task.appliedAt ?? new Date().toISOString(),
    };
    setPersistedTasks((current) =>
      (current ?? tasks).map((row) => (row.id === task.id ? appliedTask : row)),
    );
    setNotice(
      response.data.eventId
        ? `Otimização registrada (marco ${response.data.eventId}).`
        : "Tarefa aplicada.",
    );
    if (detail) {
      await hydrateOps(detail, [], campaignIds.length === 1 ? campaignIds[0] : undefined);
    } else if (organizationId) {
      await loadAppliedHistory(organizationId);
    }
  };

  const onRejectTask = async (task: SuggestedTask) => {
    setBusyTaskId(task.id);
    setError("");
    const response = await decideIntelligenceTaskFn({
      data: { taskId: task.id, decision: "REJECTED", note: "Rejeitada pelo gestor" },
    });
    setBusyTaskId(null);
    if (!response.ok) {
      setError(response.message);
      return;
    }
    setPersistedTasks((current) =>
      (current ?? tasks).map((row) => (row.id === task.id ? response.data.task : row)),
    );
    setNotice("Rejeição registrada (histórico auditável preservado).");
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

  const reprocessDaily = async () => {
    if (!organizationId || reprocessingDaily) return;
    setReprocessingDaily(true);
    setError("");
    setNotice("Reprocessando análise diária…");
    try {
      const response = await reprocessIntelligenceDailyFn({
        data: {
          organizationId,
          referenceDate: analysisDate || undefined,
        },
      });
      if (!response.ok) {
        setError(response.message);
        setNotice("");
        return;
      }
      const started = response.data.results.filter((row) => row.status === "started");
      const failed = response.data.results.filter((row) => row.status === "failed");
      setNotice(
        `Rotina diária ${response.data.referenceDate}: ${started.length} iniciada(s), ${failed.length} falha(s).`,
      );
      await loadExecutions(organizationId);
      if (started[0]?.executionId) await openExecution(started[0].executionId);
    } finally {
      setReprocessingDaily(false);
    }
  };

  const reviewCalibration = async () => {
    if (!selectedId || reviewingLock.current) return;
    reviewingLock.current = true;
    setReviewing(true);
    setError("");
    try {
      const response = await reviewMetaAiCalibrationWithAiFn({ data: { executionId: selectedId } });
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setDetail(response.data);
      setNotice("Revisão de calibração concluída.");
    } finally {
      reviewingLock.current = false;
      setReviewing(false);
    }
  };

  const accountLabel =
    selectedClient?.metaAccounts?.[0]?.id?.replace(/^act_/i, "") ||
    selectedClient?.adAccountIds?.[0]?.replace(/^act_/i, "") ||
    dashboard.accountId.replace(/^act_/i, "") ||
    "—";

  const metricCards = (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {dashboard.metrics.map((metric) => (
        <MetricCard
          key={metric.key}
          metric={metric}
          comparison={activeComparisons.find((row) => row.metricKey === metric.key)}
          currency={dashboard.currency}
          referenceLabel={
            tab === "evolution"
              ? "vs. antes"
              : periodComparisons.length > 0 || tab === "manual"
                ? "vs. período anterior"
                : "vs. dia anterior"
          }
        />
      ))}
    </div>
  );

  const campaignChoices = useMemo(() => {
    const byId = new Map<string, CampaignOption>();
    for (const campaign of availableCampaigns) byId.set(campaign.id, campaign);
    for (const campaign of dashboard.campaigns) {
      const previous = byId.get(campaign.id);
      byId.set(campaign.id, {
        id: campaign.id,
        name: campaign.name || previous?.name || campaign.id,
        objective: campaign.objective ?? previous?.objective ?? null,
        resultMetric: campaign.resultMetric ?? previous?.resultMetric ?? null,
        status: campaign.status ?? previous?.status ?? null,
        statusGroup: campaign.statusGroup ?? previous?.statusGroup ?? null,
      });
    }
    return [...byId.values()].sort((left, right) => {
      const leftActive = left.statusGroup === "Ativa" ? 0 : 1;
      const rightActive = right.statusGroup === "Ativa" ? 0 : 1;
      if (leftActive !== rightActive) return leftActive - rightActive;
      return left.name.localeCompare(right.name, "pt-BR");
    });
  }, [availableCampaigns, dashboard.campaigns]);

  const filtersShared = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12 xl:items-end">
      <label className={`${ni.field} xl:col-span-3`}>
        <span className={ni.label}>Cliente</span>
        <Select
          value={organizationId}
          onValueChange={(value) => {
            setOrganizationId(value);
            setCampaignIds([]);
            setDetail(null);
            setAvailableCampaigns([]);
            setPersistedTasks(null);
            setMarkers([]);
            setPeriodComparisons([]);
            setNotice("");
            void loadExecutions(value);
            void loadCampaignsForClient(value, period);
            void loadAppliedHistory(value);
            void loadPeriodComparisons(value, period, []);
          }}
          disabled={loadingClients || analyzing}
        >
          <SelectTrigger className={ni.input} aria-label="Selecionar cliente">
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

      {tab === "manual" ? (
        <label className={`${ni.field} xl:col-span-2`}>
          <span className={ni.label}>Conta de anúncio</span>
          <Input className={ni.input} value={accountLabel} readOnly />
        </label>
      ) : null}

      <label className={`${ni.field} ${tab === "manual" ? "xl:col-span-3" : "xl:col-span-4"}`}>
        <span className={ni.label}>Campanha</span>
        <CampaignMultiSelect
          campaigns={campaignChoices}
          selectedIds={campaignIds}
          onChange={(next) => {
            setCampaignIds(next);
            if (organizationId) void loadPeriodComparisons(organizationId, period, next);
          }}
          loading={loadingCampaigns}
          disabled={!organizationId}
        />
      </label>

      {tab === "daily" ? (
        <>
          <label className={`${ni.field} xl:col-span-3`}>
            <span className={ni.label}>Data</span>
            <Input
              type="date"
              className={ni.input}
              value={analysisDate}
              onChange={(event) => setAnalysisDate(event.target.value)}
            />
          </label>
          <div className="min-w-0 xl:col-span-2">
            <button
              type="button"
              className={`${ni.btnPrimary} w-full shrink-0 whitespace-nowrap`}
              disabled={!organizationId || loadingDetail}
              onClick={() => void pickExecutionForDaily()}
            >
              <RefreshCw className="size-4" />
              Atualizar análise
            </button>
          </div>
        </>
      ) : null}

      {tab === "manual" || tab === "evolution" ? (
        <div
          className={`grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end ${
            tab === "manual" ? "xl:col-span-4" : "xl:col-span-5"
          }`}
        >
          <div className={`${ni.field} min-w-0 overflow-hidden`}>
            <p className={ni.label}>Período</p>
            <PeriodPicker
              value={period}
              disabled={analyzing}
              triggerClassName="w-full max-w-full"
              onApply={(next) => {
                setPeriod(next);
                if (organizationId) {
                  void loadCampaignsForClient(organizationId, next);
                  void loadPeriodComparisons(organizationId, next, campaignIds);
                }
              }}
            />
          </div>
          <button
            type="button"
            className={`${ni.btnPrimary} w-full shrink-0 whitespace-nowrap sm:w-auto sm:min-w-[9.5rem]`}
            disabled={
              tab === "manual"
                ? analyzing || !organizationId || loadingClients
                : !organizationId || loadingDetail
            }
            onClick={() => {
              if (tab === "manual") runAnalysis();
              else void pickExecutionForDaily();
            }}
          >
            {tab === "manual" ? (
              <>
                <Sparkles className="size-4" />
                {analyzing ? "Gerando…" : "Gerar análise"}
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                Atualizar análise
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={`${ni.root} overflow-hidden`}>
      <IntelligenceHeader
        rightSlot={
          tab === "daily" ? (
            <span className="rounded-lg border border-[#1e3a5f] bg-[#07111f] px-3 py-2 text-sm text-[#d5e0ef]">
              {formatShortDate(analysisDate)}
            </span>
          ) : (
            <span className="rounded-lg border border-[#1e3a5f] bg-[#07111f] px-3 py-2 text-sm text-[#d5e0ef]">
              {formatShortDate(dashboard.periodStart)} – {formatShortDate(dashboard.periodEnd)}
            </span>
          )
        }
      />
      <IntelligenceTabs value={tab} onChange={setTab} />

      <div className="space-y-5 px-5 pb-6 pt-2">
        {filtersShared}

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        {notice ? <p className={ni.muted}>{notice}</p> : null}
        {loadingDetail ? <p className={ni.muted}>Carregando execução…</p> : null}

        {dashboard.executionId ? (
          <p className={`text-xs ${ni.muted}`}>
            Execução <code className="text-[#7eb6ff]">{dashboard.executionId}</code>
            {dashboard.protocolVersion ? ` · protocolo ${dashboard.protocolVersion}` : ""}
            {dashboard.analyticalStatus ? ` · ${dashboard.analyticalStatus}` : ""}
            {dashboard.publicationStatus ? ` · pub ${dashboard.publicationStatus}` : ""}
          </p>
        ) : null}

        {metricCards}

        {tab === "daily" ? (
          <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
            <PerformanceChart
              title={`Resultados diários (${dashboard.resultEventLabel})`}
              subtitle="Evolução do resultado com a aplicação das últimas otimizações."
              series={dashboard.series}
              markers={dashboard.markers}
            />
            <InsightsPanel insights={dashboard.insights} />
          </div>
        ) : null}

        {tab === "manual" ? (
          <ManualAnalysisOverview
            dashboard={dashboard}
            comparisons={activeComparisons}
          />
        ) : null}

        {tab === "evolution" ? (
          <div className="grid gap-4 xl:grid-cols-[1.3fr_0.6fr_0.8fr]">
            <PerformanceChart
              title="Evolução do CTR (Taxa de Cliques)"
              subtitle="Comparativo antes/depois exige marco de otimização persistido."
              series={dashboard.series}
              metricKey="ctr"
              markers={dashboard.markers}
            />
            <div className={`${ni.card} p-4`}>
              <h3 className={ni.title}>Impacto no CTR</h3>
              {(() => {
                const ctr = dashboard.comparisons.find((row) => row.metricKey === "ctr");
                if (!ctr || ctr.comparisonStatus !== "VALID") {
                  return (
                    <p className={`mt-4 ${ni.muted}`}>
                      Sem janela antes/depois equivalente. Marcos ainda não persistidos.
                    </p>
                  );
                }
                return (
                  <div className="mt-4 space-y-3">
                    <p className={ni.muted}>
                      Antes:{" "}
                      <span className="text-white">
                        {ctr.before?.value?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                      </span>
                    </p>
                    <p className={ni.muted}>
                      Depois:{" "}
                      <span className="text-white">
                        {ctr.after?.value?.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                      </span>
                    </p>
                    <span className={ni.badgePos}>
                      {ctr.pointsDelta != null
                        ? `${ctr.pointsDelta > 0 ? "+" : ""}${ctr.pointsDelta.toLocaleString("pt-BR", {
                            maximumFractionDigits: 2,
                          })} p.p.`
                        : "—"}
                    </span>
                  </div>
                );
              })()}
            </div>
            <div className={`${ni.card} p-4`}>
              <h3 className={ni.title}>Detalhes da otimização</h3>
              {dashboard.markers[0] ? (
                <dl className="mt-4 space-y-2 text-sm">
                  <div>
                    <dt className={ni.label}>Data</dt>
                    <dd>{formatShortDate(dashboard.markers[0].effectiveAt)}</dd>
                  </div>
                  <div>
                    <dt className={ni.label}>Tipo</dt>
                    <dd>{dashboard.markers[0].type}</dd>
                  </div>
                  <div>
                    <dt className={ni.label}>Descrição</dt>
                    <dd>{dashboard.markers[0].description}</dd>
                  </div>
                </dl>
              ) : (
                <p className={`mt-4 ${ni.muted}`}>
                  Nenhum marco registrado. Ao aplicar tarefas com persistência, a bandeira aparece
                  aqui.
                </p>
              )}
            </div>
          </div>
        ) : null}

        {tab === "evolution" ? (
          <div className="space-y-3">
            <h3 className={ni.title}>Evolução dos principais indicadores</h3>
            <ComparisonBars comparisons={activeComparisons} currency={dashboard.currency} />
          </div>
        ) : null}

        {tab !== "evolution" ? (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
            <OptimizationTaskList
              title={
                tab === "manual" ? "Otimizações recomendadas" : "Otimizações sugeridas (tarefas)"
              }
              tasks={tasks}
              onApply={(task) => void onApplyTask(task)}
              onReject={(task) => void onRejectTask(task)}
              busyId={busyTaskId}
            />
            <ClientCommunicationComposer
              clientName={dashboard.clientName || (selectedClient ? clientDisplayName(selectedClient) : "")}
              campaignName={dashboard.campaignName}
              tasks={tasks}
              sending={sendingWhatsapp}
              onSend={async (text) => {
                if (!organizationId) {
                  setError("Selecione um cliente.");
                  return;
                }
                setSendingWhatsapp(true);
                setError("");
                const response = await sendIntelligenceClientWhatsappFn({
                  data: { organizationId, text },
                });
                setSendingWhatsapp(false);
                if (!response.ok) {
                  setError(response.message);
                  return;
                }
                setNotice("Mensagem enviada ao WhatsApp do cliente.");
              }}
            />
          </div>
        ) : null}

        {tab === "manual" ? (
          <AppliedOptimizationsHistory
            items={appliedHistory}
            loading={loadingHistory}
          />
        ) : null}

        <Accordion type="single" collapsible className={`${ni.cardMuted} px-4`}>
          <AccordionItem value="lab" className="border-none">
            <AccordionTrigger className="text-sm text-[#d5e0ef] hover:no-underline">
              Laboratório de calibração (histórico / OpenAI review)
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadExecutions(organizationId || undefined)}
                  disabled={loadingList}
                >
                  Atualizar histórico
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!selectedId || reviewing || !detail?.analysisMarkdown}
                  onClick={() => void reviewCalibration()}
                >
                  {reviewing ? "Revisando…" : "Revisar calibração na OpenAI"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!organizationId || reprocessingDaily || analyzing}
                  onClick={() => void reprocessDaily()}
                >
                  {reprocessingDaily ? "Reprocessando…" : "Reprocessar diária (cliente)"}
                </Button>
              </div>
              <div className="grid gap-3 xl:grid-cols-[280px_1fr]">
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {executions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${
                        selectedId === item.id
                          ? "border-[#1d6feb] bg-[#122038]"
                          : "border-[#1e3a5f] bg-[#07111f]"
                      }`}
                      onClick={() => void openExecution(item.id)}
                    >
                      <p className="font-medium text-white">{item.clientName}</p>
                      <p className="font-mono text-[10px] text-[#8fa3bf]">{item.id}</p>
                      <p className="text-[#8fa3bf]">
                        {new Date(item.createdAt).toLocaleString("pt-BR")} · {item.status}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {detail?.analysisMarkdown ? (
                    <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#1e3a5f] bg-[#07111f] p-3 text-sm leading-6 text-[#d5e0ef]">
                      {detail.analysisMarkdown}
                    </div>
                  ) : (
                    <p className={ni.muted}>Selecione uma execução.</p>
                  )}
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
                      <label key={key} className="grid gap-1 text-xs text-[#8fa3bf]">
                        {label}
                        <Input
                          className={ni.input}
                          inputMode="numeric"
                          value={scores[key]}
                          onChange={(event) =>
                            setScores((current) => ({ ...current, [key]: event.target.value }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <Input
                    className={ni.input}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Notas de calibração"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={savingFeedback || !selectedId}
                    onClick={() => void saveFeedback()}
                  >
                    {savingFeedback ? "Salvando…" : "Salvar avaliação"}
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={analyzing}
              onClick={() => {
                const duplicate = duplicateConfirm;
                setDuplicateConfirm(null);
                if (duplicate) void openExecution(duplicate.id);
              }}
            >
              Abrir existente
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={analyzing}
              onClick={() => {
                setDuplicateConfirm(null);
                window.setTimeout(() => void executeAnalysis(), 0);
              }}
            >
              Executar novamente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
