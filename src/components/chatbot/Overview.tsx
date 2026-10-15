import { useEffect, useMemo, useState } from "react";
import { BarChart3, BriefcaseBusiness, CheckCheck, MessageSquare, Star, TrendingUp, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PeriodPicker } from "@/components/nex/PeriodPicker";
import { Button } from "@/components/ui/button";
import { chatbotOverviewFn } from "@/lib/chatbot.functions";
import { applyOverviewFilters, attendanceSeries, negotiatedLabel, ratingAverageLabel, type OverviewBoard, type OverviewFilters } from "@/lib/chatbot-evo";
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
  const ranking = useMemo(
    () => [...view.agents].sort((left, right) => (rankingMode === "vendas" ? right.success - left.success : right.wonCents - left.wonCents) || left.name.localeCompare(right.name, "pt-BR")),
    [rankingMode, view.agents],
  );
  const series = useMemo(() => attendanceSeries(view.days, filters.period), [view.days, filters.period]);

  const metrics = [
    ["Atendimentos recebidos", String(view.received), MessageSquare],
    ["Em atendimento", String(view.attending), Users],
    ["Encerrados", String(view.finished), CheckCheck],
    ["Oportunidades abertas", String(view.openDeals), BriefcaseBusiness],
    ["Valor em negociação", negotiatedLabel(view.negotiatingCents), TrendingUp],
    ["Valor ganho", negotiatedLabel(view.wonCents), TrendingUp],
    ["Clientes cadastrados", String(view.clients), Users, ""],
    ["Nota média", ratingAverageLabel(view.ratingAverage), Star, view.ratingCount ? `${view.ratingCount} ${view.ratingCount === 1 ? "avaliação" : "avaliações"}` : "Sem avaliações"],
  ] as const;

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
        {metrics.map(([label, value, Icon, hint]) => (
          <div className="metric" key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <Icon />
            </div>
            <strong className="text-lg">{value}</strong>
            {hint ? <small>{hint}</small> : null}
          </div>
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
        {view.agents.length ? (
          <div className="mt-5" style={{ height: Math.max(220, view.agents.length * 64) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={view.agents} margin={{ top: 8, right: 16, left: 8, bottom: 0 }} barGap={4} barCategoryGap={16}>
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
                <YAxis type="category" dataKey="name" width={128} reversed tick={{ fontSize: 11, fill: "var(--foreground)" }} axisLine={false} tickLine={false} />
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
