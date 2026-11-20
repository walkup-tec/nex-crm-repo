import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  History,
  Mail,
  RefreshCw,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  approveCareerApplicationFn,
  careerApplicationsFn,
  careerCompaniesFn,
  careerCompanyDetailFn,
  careerContactsFn,
  careerHistoryFn,
  careerJobsFn,
  careerOverviewFn,
  recordManualCareerApplicationFn,
  sendCareerApplicationEmailFn,
} from "@/lib/career.functions";
import { careerContactKindLabel } from "@/lib/career-access";
import { Input } from "@/components/ui/input";
import {
  careerActorLabel,
  careerKindLabel,
  careerStatusLabel,
  careerStatusTone,
  careerStatusToneClass,
} from "@/lib/career-status";

type Overview = {
  companies: number;
  jobs: number;
  compatibleJobs: number;
  contacts: number;
  applicationsPrepared: number;
  applicationsApproved: number;
  executions: number;
};

type StatTone = "neutral" | "green" | "yellow" | "red";

const STAT_TONE: Record<StatTone, { card: string; value: string }> = {
  neutral: {
    card: "border-border/80 bg-card",
    value: "text-foreground",
  },
  green: {
    card: "border-emerald-500/25 bg-emerald-500/[0.06]",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  yellow: {
    card: "border-amber-500/25 bg-amber-500/[0.06]",
    value: "text-amber-800 dark:text-amber-300",
  },
  red: {
    card: "border-red-500/25 bg-red-500/[0.06]",
    value: "text-red-700 dark:text-red-300",
  },
};

function Stat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: StatTone }) {
  const styles = STAT_TONE[tone];
  return (
    <div className={`rounded-xl border px-4 py-3 ${styles.card}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold tabular-nums ${styles.value}`}>{value}</p>
    </div>
  );
}

/** Tons sóbrios: verde = progresso, amarelo = atenção/fila, vermelho = risco, neutro = volume. */
function overviewStatTone(
  key:
    | "companies"
    | "jobs"
    | "compatibleJobs"
    | "contacts"
    | "applicationsPrepared"
    | "applicationsApproved"
    | "executions",
  value: number,
): StatTone {
  if (key === "applicationsApproved") return value > 0 ? "green" : "neutral";
  if (key === "applicationsPrepared") return value > 0 ? "yellow" : "neutral";
  if (key === "compatibleJobs") return value > 0 ? "green" : "yellow";
  if (key === "contacts") return value > 0 ? "green" : "yellow";
  if (key === "companies" || key === "jobs") return value > 0 ? "green" : "yellow";
  if (key === "executions") return value > 0 ? "neutral" : "yellow";
  return "neutral";
}

function StatusBadge({ value }: { value: string | null | undefined }) {
  const tone = careerStatusTone(value);
  return (
    <Badge variant="outline" className={careerStatusToneClass(tone)}>
      {careerStatusLabel(value)}
    </Badge>
  );
}

export function CareerWorkspace() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [companies, setCompanies] = useState<Record<string, unknown>[]>([]);
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([]);
  const [contacts, setContacts] = useState<Record<string, unknown>[]>([]);
  const [applications, setApplications] = useState<Record<string, unknown>[]>([]);
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [sendToById, setSendToById] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState("");
  const [descOpenById, setDescOpenById] = useState<Record<string, boolean>>({});
  const [detailOpenId, setDetailOpenId] = useState("");
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [contactKindFilter, setContactKindFilter] = useState("");
  const [contactStatusFilter, setContactStatusFilter] = useState("");
  const [contactCompanyFilter, setContactCompanyFilter] = useState("");
  const [jobPlatformFilter, setJobPlatformFilter] = useState("");
  const [copyHint, setCopyHint] = useState("");
  const [applyFormCompanyId, setApplyFormCompanyId] = useState("");
  const [applyTitle, setApplyTitle] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [applyNotes, setApplyNotes] = useState("");
  const [applySaving, setApplySaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const settled = await Promise.allSettled([
        careerOverviewFn(),
        careerCompaniesFn(),
        careerJobsFn(),
        careerContactsFn(),
        careerApplicationsFn(),
        careerHistoryFn(),
      ]);
      const values = settled.map((item, index) => {
        if (item.status === "fulfilled") return item.value;
        const reason = item.reason;
        const message =
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : `Falha na consulta ${index + 1} do módulo Candidatura.`;
        return { ok: false as const, message };
      });
      const [ov, co, jo, ct, ap, hi] = values;
      if (!ov || !ov.ok) {
        setError(ov?.message || "Não foi possível carregar o resumo.");
        return;
      }
      setOverview(ov.data as Overview);
      setCompanies(co && co.ok ? extractCareerItems(co.data) : []);
      setJobs(jo && jo.ok ? extractCareerItems(jo.data) : []);
      setContacts(ct && ct.ok ? extractCareerItems(ct.data) : []);
      setApplications(ap && ap.ok ? extractCareerItems(ap.data) : []);
      setHistory(hi && hi.ok ? extractCareerItems(hi.data) : []);
      const firstError = [co, jo, ct, ap, hi].find((item) => item && !item.ok);
      if (firstError && !firstError.ok) setError(firstError.message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível carregar o módulo Candidatura.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCompanyDetail = useCallback(async (id: string) => {
    setDetailOpenId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const result = await careerCompanyDetailFn({ data: { id } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setDetail(result.data as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o detalhe.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const filteredContacts = useMemo(() => {
    return contacts.filter((row) => {
      if (contactKindFilter && String(row.kind) !== contactKindFilter) return false;
      if (contactStatusFilter && String(row.verification_status) !== contactStatusFilter) return false;
      if (contactCompanyFilter && String(row.company_id) !== contactCompanyFilter) return false;
      return true;
    });
  }, [contacts, contactKindFilter, contactStatusFilter, contactCompanyFilter]);

  const filteredJobs = useMemo(() => {
    if (!jobPlatformFilter.trim()) return jobs;
    const needle = jobPlatformFilter.trim().toLowerCase();
    return jobs.filter((row) => String(row.platform || "").toLowerCase().includes(needle));
  }, [jobs, jobPlatformFilter]);

  const companyOptions = useMemo(
    () =>
      companies
        .map((row) => ({ id: String(row.id), name: String(row.name || "Empresa") }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [companies],
  );

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyHint("Copiado");
      window.setTimeout(() => setCopyHint(""), 1500);
    } catch {
      setCopyHint("Falha ao copiar");
    }
  }

  function openApplyForm(company: Record<string, unknown>) {
    setApplyFormCompanyId(String(company.id));
    setApplyTitle(`Candidatura via site — ${String(company.name || "Empresa")}`);
    setApplyUrl(String(company.website || ""));
    setApplyNotes("");
  }

  async function submitManualApply(companyId: string, jobId?: string) {
    setApplySaving(true);
    setError("");
    try {
      const result = await recordManualCareerApplicationFn({
        data: {
          companyId,
          jobId,
          title: applyTitle.trim() || undefined,
          url: applyUrl.trim() || undefined,
          notes: applyNotes.trim() || undefined,
        },
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setApplyFormCompanyId("");
      setCopyHint("Candidatura registrada");
      window.setTimeout(() => setCopyHint(""), 2000);
      await load();
      if (detailOpenId === companyId) await openCompanyDetail(companyId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar a candidatura.");
    } finally {
      setApplySaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Resultados do plugin NEX Career Intelligence v0.3.0. A pesquisa acontece no ChatGPT; a NEX persiste,
            deduplica e exibe canais verificáveis. Nenhum envio automático.
          </p>
          {copyHint ? <p className="mt-1 text-xs text-muted-foreground">{copyHint}</p> : null}
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : undefined} />
          Atualizar
        </Button>
      </div>

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Empresas"
          value={overview?.companies ?? 0}
          tone={overviewStatTone("companies", overview?.companies ?? 0)}
        />
        <Stat
          label="Vagas"
          value={overview?.jobs ?? 0}
          tone={overviewStatTone("jobs", overview?.jobs ?? 0)}
        />
        <Stat
          label="Vagas compatíveis"
          value={overview?.compatibleJobs ?? 0}
          tone={overviewStatTone("compatibleJobs", overview?.compatibleJobs ?? 0)}
        />
        <Stat
          label="Contatos"
          value={overview?.contacts ?? 0}
          tone={overviewStatTone("contacts", overview?.contacts ?? 0)}
        />
        <Stat
          label="Candidaturas preparadas"
          value={overview?.applicationsPrepared ?? 0}
          tone={overviewStatTone("applicationsPrepared", overview?.applicationsPrepared ?? 0)}
        />
        <Stat
          label="Candidaturas aprovadas"
          value={overview?.applicationsApproved ?? 0}
          tone={overviewStatTone("applicationsApproved", overview?.applicationsApproved ?? 0)}
        />
        <Stat
          label="Execuções"
          value={overview?.executions ?? 0}
          tone={overviewStatTone("executions", overview?.executions ?? 0)}
        />
      </div>

      <Tabs defaultValue="empresas">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="empresas"><Building2 className="mr-1 size-4" />Empresas</TabsTrigger>
          <TabsTrigger value="vagas"><Briefcase className="mr-1 size-4" />Vagas</TabsTrigger>
          <TabsTrigger value="contatos"><Mail className="mr-1 size-4" />Contatos</TabsTrigger>
          <TabsTrigger value="candidaturas"><Sparkles className="mr-1 size-4" />Candidaturas</TabsTrigger>
          <TabsTrigger value="historico"><History className="mr-1 size-4" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="empresas" className="space-y-3">
          {companies.length === 0 ? (
            <Empty text="Nenhuma empresa salva ainda. Use o plugin NEX Career Intelligence para descobrir e enviar." />
          ) : (
            companies.map((row) => {
              const id = String(row.id);
              const open = detailOpenId === id;
              return (
                <article key={id} className="rounded-xl border p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{String(row.name)}</h3>
                      <p className="text-sm text-muted-foreground">
                        {[row.city, row.state].filter(Boolean).join(" / ") || "Local não informado"}
                        {row.category ? ` · ${String(row.category)}` : ""}
                        {row.segment ? ` · ${String(row.segment)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge value={String(row.enrichment_status ?? "none")} />
                      <StatusBadge value={String(row.prospect_status ?? "new")} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Site: {row.website ? String(row.website) : "—"} · contatos: {String(row.contact_count ?? 0)} ·
                    vagas: {String(row.job_count ?? 0)} · candidaturas: {String(row.application_count ?? 0)}
                    {row.last_enriched_at ? ` · enriquecido: ${String(row.last_enriched_at)}` : " · enriquecimento pendente"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void (open ? (setDetailOpenId(""), setDetail(null)) : openCompanyDetail(id))}
                    >
                      {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      {open ? "Ocultar detalhe" : "Ver detalhes"}
                    </Button>
                    {row.website ? (
                      <Button type="button" size="sm" variant="ghost" asChild>
                        <a href={ensureHttp(String(row.website))} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" /> Abrir site
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant={applyFormCompanyId === id ? "secondary" : "default"}
                      onClick={() => (applyFormCompanyId === id ? setApplyFormCompanyId("") : openApplyForm(row))}
                    >
                      <Sparkles className="size-4" /> Me candidatei
                    </Button>
                  </div>
                  {applyFormCompanyId === id ? (
                    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                      <p className="text-sm text-muted-foreground">
                        Registre que você se candidatou pelo site/RH. Isso atualiza o histórico e o contador do card.
                      </p>
                      <Input
                        placeholder="Cargo / título da candidatura"
                        value={applyTitle}
                        onChange={(e) => setApplyTitle(e.target.value)}
                      />
                      <Input
                        placeholder="URL usada (site RH, formulário…)"
                        value={applyUrl}
                        onChange={(e) => setApplyUrl(e.target.value)}
                      />
                      <Input
                        placeholder="Observações (opcional)"
                        value={applyNotes}
                        onChange={(e) => setApplyNotes(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={applySaving}
                          onClick={() => void submitManualApply(id)}
                        >
                          {applySaving ? "Salvando…" : "Confirmar candidatura"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={applySaving}
                          onClick={() => setApplyFormCompanyId("")}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {open ? (
                    <CompanyDetailPanel
                      loading={detailLoading}
                      detail={detailOpenId === id ? detail : null}
                      onCopy={copyText}
                      onAppliedJob={(jobId) => void submitManualApply(id, jobId)}
                      applySaving={applySaving}
                    />
                  ) : null}
                </article>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="vagas" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="Filtrar plataforma (linkedin, gupy…)"
              value={jobPlatformFilter}
              onChange={(e) => setJobPlatformFilter(e.target.value)}
            />
          </div>
          {filteredJobs.length === 0 ? (
            <Empty text="Nenhuma vaga salva para o filtro atual. O plugin envia pesquisas para /career/jobs/search." />
          ) : (
            filteredJobs.map((row) => (
              <article key={String(row.id)} className="rounded-xl border p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{String(row.title)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {String(row.company_name || "Empresa")}
                      {row.platform ? ` · ${String(row.platform)}` : ""}
                      {row.research_mode && row.research_mode !== "unknown"
                        ? ` · ${String(row.research_mode)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {row.compatibility_score != null ? (
                      <Badge variant="secondary">{String(row.compatibility_score)}%</Badge>
                    ) : null}
                    <StatusBadge value={String(row.opportunity_status ?? "new")} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[row.work_mode, row.contract_type, row.location].filter(Boolean).join(" · ") || "Modalidade não informada"}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {String(row.compatibility_notes || row.description || "")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {row.url ? (
                    <Button type="button" size="sm" variant="outline" asChild>
                      <a href={ensureHttp(String(row.url))} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" /> Abrir vaga
                      </a>
                    </Button>
                  ) : null}
                  {row.company_id ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      disabled={applySaving || String(row.opportunity_status) === "applied"}
                      onClick={() => {
                        setApplyTitle(String(row.title || ""));
                        setApplyUrl(String(row.url || ""));
                        setApplyNotes("");
                        void submitManualApply(String(row.company_id), String(row.id));
                      }}
                    >
                      {String(row.opportunity_status) === "applied" ? "Já candidatado" : "Me candidatei"}
                    </Button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </TabsContent>

        <TabsContent value="contatos" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={contactCompanyFilter}
              onChange={(e) => setContactCompanyFilter(e.target.value)}
            >
              <option value="">Todas as empresas</option>
              {companyOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={contactKindFilter}
              onChange={(e) => setContactKindFilter(e.target.value)}
            >
              <option value="">Todos os tipos</option>
              {[
                "hr_email",
                "corporate_email",
                "whatsapp",
                "phone",
                "website",
                "recruiter_linkedin",
                "instagram",
                "facebook",
              ].map((kind) => (
                <option key={kind} value={kind}>
                  {careerContactKindLabel(kind)}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={contactStatusFilter}
              onChange={(e) => setContactStatusFilter(e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="confirmed">Confirmado</option>
              <option value="unverified">Não verificado</option>
              <option value="not_found">Não encontrado</option>
            </select>
          </div>
          {contacts.length === 0 ? (
            <Empty text="Nenhum contato enriquecido ainda. Isso significa que a pesquisa de canais ainda não foi executada (ou falhou) — não que o contato inexistente foi confirmado." />
          ) : filteredContacts.length === 0 ? (
            <Empty text="Nenhum contato corresponde aos filtros. Limpe os filtros ou execute career_companies_enrich no plugin." />
          ) : (
            filteredContacts.map((row) => {
              const value = String(row.value || "");
              const kind = String(row.kind || "");
              return (
                <article key={String(row.id)} className="rounded-xl border p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <UserRound className="size-4 text-muted-foreground" />
                    <p className="font-medium">{String(row.full_name || row.company_name || careerContactKindLabel(kind))}</p>
                    <StatusBadge value={String(row.verification_status ?? "unverified")} />
                    <Badge variant="outline">{careerContactKindLabel(kind)}</Badge>
                  </div>
                  <p className="text-sm">
                    {value || "não localizado"}
                    {row.title ? ` · ${String(row.title)}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Empresa: {String(row.company_name || "—")} · fonte: {String(row.source || "—")}
                    {row.source_url ? ` · ${String(row.source_url)}` : ""}
                    {row.verified_at ? ` · verificado: ${String(row.verified_at)}` : ""}
                  </p>
                  <ContactActions kind={kind} value={value} sourceUrl={String(row.source_url || "")} onCopy={copyText} />
                </article>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="candidaturas" className="space-y-3">
          {applications.length === 0 ? (
            <Empty text="Nenhuma candidatura preparada. Nada é enviado sem aprovação explícita." />
          ) : (
            applications.map((row) => {
              const id = String(row.id);
              const status = String(row.status);
              const canSend = status === "approved" || status === "ready";
              const job = jobs.find((item) => String(item.id) === String(row.job_id));
              const jobTitle = String(job?.title || "Vaga");
              const companyName = String(job?.company_name || "").trim();
              const jobDescription = String(job?.description || job?.compatibility_notes || "").trim();
              const descOpen = Boolean(descOpenById[id]);
              return (
                <article key={id} className="rounded-xl border px-4 py-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={status} />
                    <p className="min-w-0 flex-1 font-medium truncate" title={jobTitle}>
                      {jobTitle}
                      {companyName ? (
                        <span className="font-normal text-muted-foreground"> · {companyName}</span>
                      ) : null}
                    </p>
                    {jobDescription ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="shrink-0"
                        onClick={() =>
                          setDescOpenById((prev) => ({ ...prev, [id]: !prev[id] }))
                        }
                      >
                        {descOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        {descOpen ? "Ocultar descrição" : "Ver descrição"}
                      </Button>
                    ) : null}
                    {status === "ready" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() =>
                          void approveCareerApplicationFn({ data: { id } }).then(() => load())
                        }
                      >
                        Aprovar
                      </Button>
                    ) : null}
                    {canSend ? (
                      <>
                        <Input
                          type="email"
                          placeholder="Destino"
                          value={sendToById[id] ?? "mozart.pmo@gmail.com"}
                          onChange={(event) =>
                            setSendToById((prev) => ({ ...prev, [id]: event.target.value }))
                          }
                          className="h-8 w-full sm:w-56 shrink-0"
                        />
                        <Button
                          size="sm"
                          className="shrink-0"
                          disabled={sendingId === id}
                          onClick={() => {
                            const toEmail = (sendToById[id] ?? "mozart.pmo@gmail.com").trim();
                            setSendingId(id);
                            setError("");
                            const sendPromise = sendCareerApplicationEmailFn({ data: { id, toEmail } });
                            const timeoutMs = 90000;
                            const timeoutPromise = new Promise<never>((_, reject) => {
                              window.setTimeout(() => {
                                reject(new Error("O envio demorou demais. Verifique SMTP/anexo e tente de novo."));
                              }, timeoutMs);
                            });
                            void Promise.race([sendPromise, timeoutPromise])
                              .then((result) => {
                                setSendingId("");
                                if (!result.ok) {
                                  setError(result.message);
                                  return;
                                }
                                void load();
                              })
                              .catch((err) => {
                                setSendingId("");
                                setError(err instanceof Error ? err.message : "Falha ao enviar a candidatura.");
                              });
                          }}
                        >
                          {sendingId === id ? "Enviando…" : "Enviar"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {descOpen && jobDescription ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap border-t pt-2">
                      {jobDescription}
                    </p>
                  ) : null}
                  {status === "sent" && row.guidance ? (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{String(row.guidance)}</p>
                  ) : null}
                </article>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="historico" className="space-y-3">
          {history.length === 0 ? (
            <Empty text="Sem execuções registradas." />
          ) : (
            history.map((row) => (
              <article key={String(row.id)} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{careerKindLabel(String(row.kind))}</p>
                  <StatusBadge value={String(row.status)} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {String(row.created_at)} · {careerActorLabel(String(row.actor_source))} · {String(row.id)}
                </p>
              </article>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

/** Aceita `{ items }`, array direto ou envelope aninhado das server fns. */
function extractCareerItems(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (!data || typeof data !== "object") return [];
  const root = data as { items?: unknown; data?: unknown };
  if (Array.isArray(root.items)) return root.items as Record<string, unknown>[];
  if (root.data && typeof root.data === "object") {
    const nested = root.data as { items?: unknown };
    if (Array.isArray(nested.items)) return nested.items as Record<string, unknown>[];
    if (Array.isArray(root.data)) return root.data as Record<string, unknown>[];
  }
  return [];
}

function ensureHttp(url: string) {
  if (!url) return "#";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function whatsappHref(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "#";
}

function ContactActions({
  kind,
  value,
  sourceUrl,
  onCopy,
}: {
  kind: string;
  value: string;
  sourceUrl: string;
  onCopy: (value: string) => void;
}) {
  if (!value && !sourceUrl) return null;
  const actions: Array<{ label: string; href?: string; copy?: string }> = [];
  if (kind.includes("email") && value) {
    actions.push({ label: "Copiar e-mail", copy: value });
    actions.push({ label: "Abrir e-mail", href: `mailto:${value}` });
  } else if (kind === "whatsapp" || kind === "business_whatsapp") {
    if (value) {
      actions.push({ label: "Abrir WhatsApp", href: whatsappHref(value) });
      actions.push({ label: "Copiar número", copy: value });
    }
  } else if (kind === "phone") {
    if (value) {
      actions.push({ label: "Copiar telefone", copy: value });
      actions.push({ label: "Ligar", href: `tel:${value}` });
    }
  } else if (value) {
    actions.push({ label: "Abrir link", href: ensureHttp(value) });
    actions.push({ label: "Copiar", copy: value });
  }
  if (sourceUrl) actions.push({ label: "Fonte", href: ensureHttp(sourceUrl) });

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) =>
        action.href ? (
          <Button key={action.label} type="button" size="sm" variant="ghost" asChild>
            <a href={action.href} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> {action.label}
            </a>
          </Button>
        ) : (
          <Button key={action.label} type="button" size="sm" variant="ghost" onClick={() => onCopy(action.copy || "")}>
            <Copy className="size-4" /> {action.label}
          </Button>
        ),
      )}
    </div>
  );
}

function groupContactsBySection(contacts: Record<string, unknown>[]) {
  const buckets: Record<string, Record<string, unknown>[]> = {
    emails: [],
    phones: [],
    websites: [],
    recruiters: [],
    social: [],
    other: [],
  };
  for (const row of contacts) {
    const kind = String(row.kind || "");
    if (kind === "hr_email" || kind === "recruiting_email" || kind === "corporate_email") buckets.emails.push(row);
    else if (kind === "whatsapp" || kind === "business_whatsapp" || kind === "phone") buckets.phones.push(row);
    else if (kind === "website" || kind === "company_linkedin") buckets.websites.push(row);
    else if (kind === "recruiter_linkedin" || kind === "marketing_manager_linkedin" || kind === "person") {
      buckets.recruiters.push(row);
    } else if (kind === "instagram" || kind === "facebook") buckets.social.push(row);
    else buckets.other.push(row);
  }
  return buckets;
}

function CompanyDetailPanel({
  loading,
  detail,
  onCopy,
  onAppliedJob,
  applySaving,
}: {
  loading: boolean;
  detail: Record<string, unknown> | null;
  onCopy: (value: string) => void;
  onAppliedJob?: (jobId: string) => void;
  applySaving?: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando detalhes…</p>;
  }
  if (!detail) {
    return <p className="text-sm text-muted-foreground">Detalhe indisponível.</p>;
  }
  const contacts = Array.isArray(detail.contacts) ? (detail.contacts as Record<string, unknown>[]) : [];
  const jobs = Array.isArray(detail.jobs) ? (detail.jobs as Record<string, unknown>[]) : [];
  const applications = Array.isArray(detail.applications) ? (detail.applications as Record<string, unknown>[]) : [];
  const groups = groupContactsBySection(contacts.filter((row) => row.verification_status !== "not_found"));
  const notFound = contacts.filter((row) => row.verification_status === "not_found");

  function Section({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
    if (!rows.length) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">{title}</h4>
        {rows.map((row) => (
          <div key={String(row.id)} className="rounded-lg border px-3 py-2 text-sm">
            <p className="font-medium">
              {careerContactKindLabel(String(row.kind))} · {String(row.value || "—")}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.full_name ? `${String(row.full_name)} · ` : ""}
              {row.title ? `${String(row.title)} · ` : ""}
              fonte: {String(row.source || "—")}
              {row.source_url ? ` · ${String(row.source_url)}` : ""}
            </p>
            <ContactActions
              kind={String(row.kind)}
              value={String(row.value || "")}
              sourceUrl={String(row.source_url || "")}
              onCopy={onCopy}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 border-t pt-3">
      <Section title="E-mails" rows={groups.emails} />
      <Section title="Telefones e WhatsApp" rows={groups.phones} />
      <Section title="Sites oficiais" rows={groups.websites} />
      <Section title="Recrutadores" rows={groups.recruiters} />
      <Section title="Redes sociais" rows={groups.social} />
      <Section title="Outros" rows={groups.other} />
      {notFound.length ? (
        <p className="text-xs text-muted-foreground">
          Canais pesquisados sem resultado: {notFound.map((row) => careerContactKindLabel(String(row.kind))).join(", ")}.
        </p>
      ) : null}
      {!contacts.length ? (
        <p className="text-sm text-muted-foreground">
          Nenhum contato persistido. Execute o enriquecimento no ChatGPT (`career_companies_enrich`) — o painel não pesquisa na web.
        </p>
      ) : null}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Vagas relacionadas ({jobs.length})</h4>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem vagas vinculadas a esta empresa.</p>
        ) : (
          jobs.map((job) => (
            <div key={String(job.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <span>
                {String(job.title)}
                {job.platform ? ` · ${String(job.platform)}` : ""}
                {job.opportunity_status ? ` · ${careerStatusLabel(String(job.opportunity_status))}` : ""}
              </span>
              <div className="flex flex-wrap gap-1">
                {job.url ? (
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <a href={ensureHttp(String(job.url))} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" /> Abrir
                    </a>
                  </Button>
                ) : null}
                {onAppliedJob ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={applySaving || String(job.opportunity_status) === "applied"}
                    onClick={() => onAppliedJob(String(job.id))}
                  >
                    {String(job.opportunity_status) === "applied" ? "Já candidatado" : "Me candidatei"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Candidaturas ({applications.length})</h4>
        {applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma candidatura registrada para esta empresa.</p>
        ) : (
          applications.map((app) => (
            <div key={String(app.id)} className="rounded-lg border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={String(app.status)} />
                <span className="text-xs text-muted-foreground">{String(app.updated_at || app.created_at || "")}</span>
              </div>
              {app.guidance ? (
                <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{String(app.guidance)}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
