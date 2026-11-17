import { useCallback, useEffect, useState } from "react";
import { Briefcase, Building2, History, Mail, RefreshCw, Sparkles, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  approveCareerApplicationFn,
  careerApplicationsFn,
  careerCompaniesFn,
  careerContactsFn,
  careerHistoryFn,
  careerJobsFn,
  careerOverviewFn,
  sendCareerApplicationEmailFn,
} from "@/lib/career.functions";
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
      setCompanies(co && co.ok ? ((co.data as { items: Record<string, unknown>[] }).items ?? []) : []);
      setJobs(jo && jo.ok ? ((jo.data as { items: Record<string, unknown>[] }).items ?? []) : []);
      setContacts(ct && ct.ok ? ((ct.data as { items: Record<string, unknown>[] }).items ?? []) : []);
      setApplications(ap && ap.ok ? ((ap.data as { items: Record<string, unknown>[] }).items ?? []) : []);
      setHistory(hi && hi.ok ? ((hi.data as { items: Record<string, unknown>[] }).items ?? []) : []);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Resultados do plugin NEX Career Intelligence. A pesquisa acontece no ChatGPT; a NEX persiste e deduplica.
          </p>
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
            companies.map((row) => (
              <article key={String(row.id)} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{String(row.name)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {[row.city, row.state].filter(Boolean).join(" / ") || "Local não informado"}
                      {row.segment ? ` · ${String(row.segment)}` : ""}
                    </p>
                  </div>
                  <StatusBadge value={String(row.prospect_status ?? "new")} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {row.website ? String(row.website) : "Sem site"} · fonte: {String(row.source || "—")}
                </p>
              </article>
            ))
          )}
        </TabsContent>

        <TabsContent value="vagas" className="space-y-3">
          {jobs.length === 0 ? (
            <Empty text="Nenhuma vaga salva. O plugin envia pesquisas para /career/jobs/search." />
          ) : (
            jobs.map((row) => (
              <article key={String(row.id)} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{String(row.title)}</h3>
                    <p className="text-sm text-muted-foreground">{String(row.company_name || "Empresa")}</p>
                  </div>
                  <div className="flex gap-2">
                    {row.compatibility_score != null ? (
                      <Badge variant="secondary">{String(row.compatibility_score)}%</Badge>
                    ) : null}
                    <StatusBadge value={String(row.opportunity_status ?? "new")} />
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{String(row.compatibility_notes || row.description || "")}</p>
              </article>
            ))
          )}
        </TabsContent>

        <TabsContent value="contatos" className="space-y-3">
          {contacts.length === 0 ? (
            <Empty text="Nenhum contato enriquecido." />
          ) : (
            contacts.map((row) => (
              <article key={String(row.id)} className="rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <UserRound className="size-4 text-muted-foreground" />
                  <p className="font-medium">{String(row.full_name || row.value || "Contato")}</p>
                  <StatusBadge value={String(row.verification_status ?? "unverified")} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {String(row.kind)} · {String(row.value || "não localizado")} · {String(row.source || "—")}
                </p>
              </article>
            ))
          )}
        </TabsContent>

        <TabsContent value="candidaturas" className="space-y-3">
          {applications.length === 0 ? (
            <Empty text="Nenhuma candidatura preparada. Nada é enviado sem aprovação explícita." />
          ) : (
            applications.map((row) => {
              const id = String(row.id);
              const status = String(row.status);
              const emailBody = String(row.email_body || "").trim();
              const intro = String(row.intro_message || row.compatibility_analysis || "—");
              const canSend = status === "approved" || status === "ready";
              return (
              <article key={id} className="rounded-xl border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge value={status} />
                  {status === "ready" ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        void approveCareerApplicationFn({ data: { id } }).then(() => load())
                      }
                    >
                      Aprovar
                    </Button>
                  ) : null}
                </div>
                <p className="text-sm whitespace-pre-wrap">{intro}</p>
                {emailBody ? (
                  <div className="rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Corpo do e-mail</p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{emailBody}</p>
                  </div>
                ) : null}
                {canSend ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      type="email"
                      placeholder="Destino (ex.: mozart.pmo@gmail.com)"
                      value={sendToById[id] ?? "mozart.pmo@gmail.com"}
                      onChange={(event) =>
                        setSendToById((prev) => ({ ...prev, [id]: event.target.value }))
                      }
                      className="sm:max-w-sm"
                    />
                    <Button
                      size="sm"
                      disabled={sendingId === id}
                      onClick={() => {
                        const toEmail = (sendToById[id] ?? "mozart.pmo@gmail.com").trim();
                        setSendingId(id);
                        void sendCareerApplicationEmailFn({ data: { id, toEmail } })
                          .then((result) => {
                            if (!result.ok) {
                              setError(result.message);
                              return;
                            }
                            return load();
                          })
                          .finally(() => setSendingId(""));
                      }}
                    >
                      {sendingId === id ? "Enviando…" : "Enviar por e-mail"}
                    </Button>
                  </div>
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
