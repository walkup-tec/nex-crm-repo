import { useEffect, useId, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BarChart3, Info } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
import { Button } from "@/components/ui/button";
import { chatbotOverviewFn } from "@/lib/chatbot.functions";
import { applyOverviewFilters, attendanceSeries, negotiatedLabel, percentAgainstPrevious, previousOverviewPeriod, ratingAverageLabel, type OverviewBoard, type OverviewFilters, type OverviewTrends } from "@/lib/chatbot-evo";
import { JourneyFunnel } from "@/components/nex/StageFunnel";
import { SharePie } from "./SharePie";
import { PageHeading } from "./common";

const stagePalette = ["var(--primary)", "var(--info)", "var(--warning)", "oklch(0.72 0.16 330)", "var(--success)", "var(--destructive)"];

function stageFill(name: string, index: number) {
  const key = name.trim().toLocaleLowerCase("pt-BR");
  if (key === "sucesso") return "var(--success)";
  if (key === "perdido") return "var(--destructive)";
  return stagePalette[index % stagePalette.length];
}

const clearedFilters: OverviewFilters = { period: { mode: "total" }, attendantId: "", channelId: "" };

function axisTop(max: number) {
  const top = Number.isFinite(max) ? max : 0;
  return Math.max(1, Math.ceil(top * 1.25));
}

function countLabel(value: unknown) {
  const amount = Number(value);
  return amount > 0 ? String(amount) : "";
}

function smoothSparkline(values: Array<number | null>) {
  const series = values.filter((value): value is number => value != null && Number.isFinite(value));
  const points = (series.length > 1 ? series : [series[0] ?? 0, series[0] ?? 0]).map((value) => value);
  const width = 120;
  const height = 36;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((value, index) => ({
    x: index * step,
    y: 4 + (1 - (value - min) / span) * (height - 10),
  }));
  let line = `M ${coords[0]?.x ?? 0} ${coords[0]?.y ?? height / 2}`;
  for (let index = 0; index < coords.length - 1; index += 1) {
    const previous = coords[index - 1] ?? coords[index];
    const current = coords[index];
    const next = coords[index + 1];
    const following = coords[index + 2] ?? next;
    if (!current || !next) continue;
    const controlStartX = current.x + (next.x - (previous?.x ?? current.x)) / 6;
    const controlStartY = current.y + (next.y - (previous?.y ?? current.y)) / 6;
    const controlEndX = next.x - ((following?.x ?? next.x) - current.x) / 6;
    const controlEndY = next.y - ((following?.y ?? next.y) - current.y) / 6;
    line += ` C ${controlStartX} ${controlStartY}, ${controlEndX} ${controlEndY}, ${next.x} ${next.y}`;
  }
  const last = coords[coords.length - 1] ?? coords[0];
  return { line, area: `${line} L ${last?.x ?? width} ${height} L 0 ${height} Z` };
}

function Sparkline({ values }: { values: Array<number | null> }) {
  const id = useId().replace(/:/g, "");
  const { line, area } = smoothSparkline(values);
  return (
    <svg className="metric-spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.42" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function PeriodDelta({ bounded, percent }: { bounded: boolean; percent: number | null }) {
  if (!bounded) return <p className="metric-delta flat"><span>Todo o período</span></p>;
  if (percent == null) return <p className="metric-delta flat"><span>Sem base no período anterior</span></p>;
  const direction = percent > 0 ? "up" : percent < 0 ? "down" : "flat";
  return (
    <p className={`metric-delta ${direction}`}>
      {percent > 0 ? <ArrowUp /> : percent < 0 ? <ArrowDown /> : null}
      <b>{percent > 0 ? `+${percent}%` : `${percent}%`}</b>
      <span>vs. período anterior</span>
    </p>
  );
}

const emptyBoard: OverviewBoard = {
  stages: [],
  attendants: [],
  channels: [],
  conversations: [],
  contacts: [],
  ratings: [],
  userId: "",
  admin: false,
};

export function Overview({ reports = false }: { reports?: boolean }) {
  const [filters, setFilters] = useState<OverviewFilters>(clearedFilters);
  const [rankingMode, setRankingMode] = useState<"vendas" | "monetario">("vendas");
  const [board, setBoard] = useState<OverviewBoard>(emptyBoard);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void chatbotOverviewFn().then((result) => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setBoard(result.data);
    });
  }, []);

  const view = useMemo(() => applyOverviewFilters(board, filters), [board, filters]);
  const previousPeriod = useMemo(() => previousOverviewPeriod(filters.period), [filters.period]);
  const previousView = useMemo(
    () => (previousPeriod ? applyOverviewFilters(board, { ...filters, period: previousPeriod }) : null),
    [board, filters, previousPeriod],
  );
  const performance = useMemo(
    () => [...view.agents].sort((left, right) => right.total - left.total || left.name.localeCompare(right.name, "pt-BR")),
    [view.agents],
  );
  const ranking = useMemo(
    () => [...view.agents].sort((left, right) => (rankingMode === "vendas" ? right.success - left.success : right.wonCents - left.wonCents) || left.name.localeCompare(right.name, "pt-BR")),
    [rankingMode, view.agents],
  );
  const series = useMemo(() => attendanceSeries(view.days, filters.period), [view.days, filters.period]);

  const emptyTrends: OverviewTrends = { received: [], attending: [], finished: [], openDeals: [], negotiatingCents: [], wonCents: [], clients: [], rating: [] };
  const trends = view.trends ?? emptyTrends;
  const cards = [
    {
      label: "Atendimentos recebidos",
      info: "Contatos que entraram em contato no período filtrado.",
      value: String(view.received),
      percent: previousView ? percentAgainstPrevious(view.received, previousView.received) : null,
      series: trends.received,
    },
    {
      label: "Em atendimento",
      info: "Contatos que estão com um atendente entre os atendimentos do período.",
      value: String(view.attending),
      percent: previousView ? percentAgainstPrevious(view.attending, previousView.attending) : null,
      series: trends.attending,
    },
    {
      label: "Encerrados",
      info: "Soma dos atendimentos finalizados no período.",
      value: String(view.finished),
      percent: previousView ? percentAgainstPrevious(view.finished, previousView.finished) : null,
      series: trends.finished,
    },
    {
      label: "Oportunidades abertas",
      info: "Contatos com valor negociado no período.",
      value: String(view.openDeals),
      percent: previousView ? percentAgainstPrevious(view.openDeals, previousView.openDeals) : null,
      series: trends.openDeals,
    },
    {
      label: "Valor em negociação",
      info: "Soma dos valores negociados no período.",
      value: negotiatedLabel(view.negotiatingCents),
      percent: previousView ? percentAgainstPrevious(view.negotiatingCents, previousView.negotiatingCents) : null,
      series: trends.negotiatingCents,
    },
    {
      label: "Valor ganho",
      info: "Soma dos valores dos contatos na etapa Sucesso no período.",
      value: negotiatedLabel(view.wonCents),
      percent: previousView ? percentAgainstPrevious(view.wonCents, previousView.wonCents) : null,
      series: trends.wonCents,
    },
    {
      label: "Clientes cadastrados",
      info: "Clientes visíveis na tela Clientes, dentro do filtro.",
      value: String(view.clients),
      percent: previousView ? percentAgainstPrevious(view.clients, previousView.clients) : null,
      series: trends.clients,
    },
    {
      label: "Nota média",
      info: "Média das avaliações recebidas no período.",
      value: ratingAverageLabel(view.ratingAverage),
      hint: view.ratingCount ? `${view.ratingCount} ${view.ratingCount === 1 ? "avaliação" : "avaliações"}` : "Sem avaliações",
      percent: previousView && view.ratingAverage != null && previousView.ratingAverage != null ? percentAgainstPrevious(view.ratingAverage, previousView.ratingAverage) : null,
      series: trends.rating,
    },
  ];

  return (
    <main className="page">
      <PageHeading
        title={reports ? "Relatórios" : "Dashboard Chatbot"}
        description={reports ? "Uma visão clara dos resultados da sua operação." : "Seu atendimento e sua operação comercial, em perspectiva."}
      />
      <div className="overview-filters">
        <label>
          Período
          <span className="period-picker">
            <PeriodPicker
              value={filters.period}
              totalHint="Exibe os indicadores de todo o período disponível, desde o início dos atendimentos."
              onApply={(period) => setFilters((current) => ({ ...current, period }))}
            />
          </span>
        </label>
        <label>
          Atendente
          <select aria-label="Atendente" value={filters.attendantId} onChange={(event) => setFilters((current) => ({ ...current, attendantId: event.target.value }))}>
            <option value="">Todos os atendentes</option>
            {board.attendants.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          Canal
          <select aria-label="Canal" value={filters.channelId} onChange={(event) => setFilters((current) => ({ ...current, channelId: event.target.value }))}>
            <option value="">Todos os canais</option>
            {board.channels.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <Button type="button" variant="outline" className="overview-clear" onClick={() => setFilters(clearedFilters)}>Limpar filtro</Button>
      </div>
      {message ? <p className="info-note mb-5">{message}</p> : null}
      <div className="stats-strip">
        {cards.map((card) => (
          <article className="metric metric-rich" key={card.label}>
            <div className="metric-top">
              <span>{card.label}</span>
              <button type="button" className="metric-info" title={card.info} aria-label={card.info}>
                <Info />
              </button>
            </div>
            <strong>{card.value}</strong>
            {"hint" in card && card.hint ? <small>{card.hint}</small> : null}
            <PeriodDelta bounded={previousView != null} percent={card.percent} />
            <Sparkline values={card.series} />
          </article>
        ))}
      </div>
      <section className="chart-panel">
        <h2>Volume de atendimentos</h2>
        <div className="mt-5 h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} domain={[0, (max: number) => Math.max(max, 1)]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                cursor={{ stroke: "var(--border)" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const count = Number(payload[0]?.value ?? 0);
                  return (
                    <div className="rounded-md border bg-card px-3 py-2 text-xs">
                      <p className="text-muted-foreground">{label}</p>
                      <p className="font-semibold">{count} {count === 1 ? "atendimento" : "atendimentos"}</p>
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} dot={series.length <= 1 ? { r: 3, strokeWidth: 0, fill: "var(--primary)" } : false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <div className="overview-split">
        <div className="share-stack">
          <SharePie title="Produto" slices={view.productShares} />
          <SharePie title="Canais" slices={view.channelShares} />
        </div>
        <section className="chart-panel overview-funnel">
          <h2>Distribuição por etapa</h2>
          {view.stages.length ? (
            <div className="overview-funnel-fit">
              <JourneyFunnel
                compact
                floor={0.2}
                label="Funil das etapas do atendimento"
                fills={view.stages.map((stage, index) => stageFill(stage.name, index))}
                stages={view.stages.map((stage) => ({
                  label: stage.name,
                  value: String(stage.count),
                  amount: stage.count,
                }))}
              />
            </div>
          ) : (
            <div className="chart-empty">Ainda não há etapas para exibir</div>
          )}
        </section>
      </div>
      <section className="chart-panel mt-5">
        <h2>Desempenho por atendente</h2>
        {performance.length ? (
          <div className="mt-5" style={{ height: Math.max(220, performance.length * 64) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={performance} margin={{ top: 8, right: 16, left: 8, bottom: 0 }} barGap={4} barCategoryGap={16}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" allowDecimals={false} domain={[0, axisTop]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 11, fill: "var(--foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--muted)", fillOpacity: 0.35 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const total = Number(payload.find((item) => item.dataKey === "total")?.value ?? 0);
                    const success = Number(payload.find((item) => item.dataKey === "success")?.value ?? 0);
                    return (
                      <div className="rounded-md border bg-card px-3 py-2 text-xs">
                        <p className="font-semibold">{label}</p>
                        <p className="mt-1 text-muted-foreground">Atendimento: {total}</p>
                        <p className="text-muted-foreground">sucesso: {success}</p>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="total" name="Atendimento" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={12}>
                  <LabelList dataKey="total" position="right" fill="var(--foreground)" fontSize={11} formatter={countLabel} />
                </Bar>
                <Bar dataKey="success" name="sucesso" fill="var(--success)" radius={[0, 4, 4, 0]} barSize={12}>
                  <LabelList dataKey="success" position="right" fill="var(--foreground)" fontSize={11} formatter={countLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty-state">
            <BarChart3 />
            <p>Nenhum resultado disponível.</p>
          </div>
        )}
      </section>
      <section className="chart-panel mt-5">
        <div className="ranking-head">
          <h2>Ranking Atendentes</h2>
          <div className="ranking-switch" role="group" aria-label="Tipo do ranking">
            <button type="button" aria-pressed={rankingMode === "vendas"} onClick={() => setRankingMode("vendas")}>Vendas</button>
            <button type="button" aria-pressed={rankingMode === "monetario"} onClick={() => setRankingMode("monetario")}>Monetário</button>
          </div>
        </div>
        {ranking.length ? (
          <div className="mt-5" style={{ height: Math.max(220, ranking.length * 52) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={ranking} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  domain={[0, axisTop]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(value) => (rankingMode === "monetario" ? negotiatedLabel(Number(value)) : String(value))}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis type="category" dataKey="name" width={128} tick={{ fontSize: 11, fill: "var(--foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--muted)", fillOpacity: 0.35 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const value = Number(payload[0]?.value ?? 0);
                    return (
                      <div className="rounded-md border bg-card px-3 py-2 text-xs">
                        <p className="font-semibold">{label}</p>
                        <p className="mt-1 text-muted-foreground">{rankingMode === "vendas" ? `${value} ${value === 1 ? "venda" : "vendas"}` : negotiatedLabel(value)}</p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey={rankingMode === "vendas" ? "success" : "wonCents"}
                  name={rankingMode === "vendas" ? "Vendas" : "Monetário"}
                  fill={rankingMode === "vendas" ? "var(--success)" : "var(--primary)"}
                  radius={[0, 4, 4, 0]}
                  barSize={14}
                >
                  <LabelList
                    dataKey={rankingMode === "vendas" ? "success" : "wonCents"}
                    position="right"
                    fill="var(--foreground)"
                    fontSize={11}
                    formatter={(value: unknown) => {
                      const amount = Number(value);
                      if (!amount) return "";
                      return rankingMode === "vendas" ? String(amount) : negotiatedLabel(amount);
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty-state">
            <BarChart3 />
            <p>Nenhum resultado disponível.</p>
          </div>
        )}
      </section>
    </main>
  );
}
