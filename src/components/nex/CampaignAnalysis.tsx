import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildAnalysis,
  changePercent,
  formatDecimal,
  formatInteger,
  formatMoney,
  formatPercent,
  funnelStageWidths,
  type ChangeSense,
  type Grain,
} from "@/lib/meta-analysis";
import type { MetaPerformanceView } from "@/lib/meta-access";

const grains: { id: Grain; label: string }[] = [
  { id: "day", label: "Diário" },
  { id: "week", label: "Semanal" },
  { id: "month", label: "Mensal" },
];

function Delta({
  current,
  previous,
  sense,
}: {
  current: number | null;
  previous: number | null;
  sense: ChangeSense;
}) {
  const change = changePercent(current, previous);
  if (current == null || previous == null) return null;
  if (change == null)
    return <p className="mt-2 text-xs text-muted-foreground">Sem base no período anterior</p>;
  const rising = change > 0.05;
  const falling = change < -0.05;
  const Icon = rising ? ArrowUpRight : falling ? ArrowDownRight : Minus;
  const positive = (sense === "up-good" && rising) || (sense === "down-good" && falling);
  const attention = (sense === "up-good" && falling) || (sense === "down-good" && rising);
  const tone =
    sense === "neutral"
      ? "text-muted-foreground"
      : positive
        ? "text-success"
        : attention
          ? "text-warning"
          : "text-muted-foreground";
  return (
    <p className={`mt-2 flex items-center gap-1 text-xs font-medium ${tone}`}>
      <Icon className="size-3.5" />
      {formatPercent(Math.abs(change))} vs. período anterior
    </p>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}

function EmptyChart() {
  return (
    <p className="mt-6 text-sm text-muted-foreground">
      Não há dados suficientes para esta análise no período selecionado.
    </p>
  );
}

function AxisTooltip({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: string;
  rows: { name: string; value: string }[];
}) {
  if (!active) return null;
  return (
    <div className="min-w-44 rounded-md border bg-popover px-3 py-2.5 text-popover-foreground shadow-sm">
      <p className="mb-2 border-b pb-2 text-xs font-semibold">{label}</p>
      <div className="space-y-1.5 text-xs">
        {rows.map((row) => (
          <div key={row.name} className="flex justify-between gap-5">
            <span className="text-muted-foreground">{row.name}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CampaignAnalysis({
  view,
  campaignId = null,
  variant = "full",
}: {
  view: MetaPerformanceView;
  campaignId?: string | null;
  variant?: "full" | "campaign";
}) {
  const [grain, setGrain] = useState<Grain | null>(null);
  useEffect(() => {
    setGrain(null);
  }, [view.period, campaignId]);
  const model = useMemo(
    () =>
      view.kpis
        ? buildAnalysis({
            period: view.period,
            campaigns: view.campaigns,
            kpis: view.kpis,
            previous: view.previous,
            previousReady: view.previousReady,
            previousCampaigns: view.previousCampaigns,
            days: view.days,
            campaignId,
            ...(grain ? { grain } : {}),
          })
        : null,
    [view, campaignId, grain],
  );
  if (!view.kpis || !model) return null;
  const currency = view.currency || "BRL";
  const resultsChange = changePercent(model.current.results, model.previous?.results ?? null);
  const costChange = changePercent(
    model.rates.costPerResult,
    model.previousRates?.costPerResult ?? null,
  );
  const hasCost = model.buckets.some((bucket) => bucket.costPerResult != null);
  const hasMovement = model.buckets.some(
    (bucket) =>
      bucket.spend > 0 || bucket.results > 0 || bucket.impressions > 0 || bucket.clicks > 0,
  );
  const ranked =
    variant === "full" && !campaignId && model.campaigns.length > 1 ? model.campaigns : [];
  const withCost = ranked.filter((row) => row.costPerResult != null);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-lg border bg-card p-5 sm:col-span-1">
          <p className="text-sm text-muted-foreground">Resultados</p>
          <strong className="mt-2 block font-display text-3xl">
            {model.comparable ? formatInteger(model.current.results) : "—"}
          </strong>
          <p className="mt-1 text-xs text-muted-foreground">
            {model.comparable ? model.resultLabel : "As campanhas medem resultados diferentes."}
          </p>
          {model.comparable && (
            <Delta
              current={model.current.results}
              previous={model.previous?.results ?? null}
              sense="up-good"
            />
          )}
        </article>
        <article className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">Custo por resultado</p>
          <strong className="mt-2 block font-display text-3xl">
            {formatMoney(model.rates.costPerResult, currency)}
          </strong>
          <p className="mt-1 text-xs text-muted-foreground">Média do período</p>
          <Delta
            current={model.rates.costPerResult}
            previous={model.comparable ? (model.previousRates?.costPerResult ?? null) : null}
            sense="down-good"
          />
        </article>
        <article className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">Investimento</p>
          <strong className="mt-2 block font-display text-3xl">
            {formatMoney(model.current.spend, currency)}
          </strong>
          <Delta
            current={model.current.spend}
            previous={model.previous?.spend ?? null}
            sense="neutral"
          />
        </article>
        <article className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">Alcance</p>
          <strong className="mt-2 block font-display text-3xl">
            {formatInteger(model.current.reach)}
          </strong>
          <p className="mt-1 text-xs text-muted-foreground">Pessoas alcançadas</p>
          <Delta
            current={model.current.reach}
            previous={model.previous?.reach ?? null}
            sense="up-good"
          />
        </article>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SmallMetric
          label="Impressões"
          value={formatInteger(model.current.impressions)}
          hint="Exibições dos anúncios"
          current={model.current.impressions}
          previous={model.previous?.impressions ?? null}
          sense="neutral"
        />
        <SmallMetric
          label="Cliques"
          value={formatInteger(model.current.clicks)}
          hint="Cliques registrados"
          current={model.current.clicks}
          previous={model.previous?.clicks ?? null}
          sense="up-good"
        />
        <SmallMetric
          label="CTR"
          value={formatPercent(model.rates.ctr)}
          hint="Percentual de impressões que geraram cliques."
          current={model.rates.ctr}
          previous={model.previousRates?.ctr ?? null}
          sense="up-good"
        />
        <SmallMetric
          label="CPC"
          value={formatMoney(model.rates.cpc, currency)}
          hint="Valor médio investido para gerar cada clique."
          current={model.rates.cpc}
          previous={model.previousRates?.cpc ?? null}
          sense="down-good"
        />
        <SmallMetric
          label="CPM"
          value={formatMoney(model.rates.cpm, currency)}
          hint="Custo por mil impressões. Sem classificação automática."
          current={model.rates.cpm}
          previous={model.previousRates?.cpm ?? null}
          sense="neutral"
        />
        <SmallMetric
          label="Frequência"
          value={formatDecimal(model.rates.frequency)}
          hint="Média de exibições por pessoa. Sem classificação automática."
          current={model.rates.frequency}
          previous={model.previousRates?.frequency ?? null}
          sense="neutral"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,280px)_1fr]">
        <Panel title={model.status?.label ?? "Comparação"}>
          {model.status ? (
            <ul className="mt-4 space-y-2 text-sm">
              {model.status.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {view.period.mode === "total"
                ? "A comparação com o período anterior fica disponível ao escolher um intervalo com início e fim."
                : "Ainda não há base suficiente do período anterior para classificar a evolução."}
            </p>
          )}
        </Panel>
        <Panel
          title="Insights NEX"
          description="Leituras feitas apenas com os números deste período e do período anterior."
        >
          {model.insights.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Não há variação suficiente para um insight além dos números acima.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {model.insights.map((insight) => (
                <li key={`${insight.title}-${insight.text}`} className="rounded-md border p-3">
                  <p className="text-sm font-semibold">{insight.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{insight.text}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      <div className="flex flex-wrap gap-2">
        {grains.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded-md border px-3 py-1.5 text-sm ${model.grain === item.id ? "bg-primary text-primary-foreground" : "bg-card"}`}
            aria-pressed={model.grain === item.id}
            onClick={() => setGrain(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Evolução dos resultados"
          description="Resultados gerados ao longo do período selecionado."
        >
          <div className="mt-4">
            <strong className="font-display text-2xl">
              {model.comparable ? `${formatInteger(model.current.results)} resultados` : "—"}
            </strong>
            {model.comparable && resultsChange != null && (
              <p className="text-sm text-muted-foreground">
                {resultsChange >= 0 ? "↑" : "↓"} {formatPercent(Math.abs(resultsChange))} vs.
                período anterior
              </p>
            )}
          </div>
          {!model.comparable || model.buckets.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={model.buckets} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      const point = payload?.[0]?.payload as { results?: number } | undefined;
                      return (
                        <AxisTooltip
                          active={Boolean(active)}
                          label={String(label ?? "")}
                          rows={[{ name: "Resultados", value: formatInteger(point?.results) }]}
                        />
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="results"
                    name="Resultados"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={model.buckets.length <= 31}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel
          title="Evolução do custo por resultado"
          description="Quanto, em média, foi investido para gerar cada resultado."
        >
          <div className="mt-4">
            <strong className="font-display text-2xl">
              {formatMoney(model.rates.costPerResult, currency)}
            </strong>
            <p className="text-sm text-muted-foreground">Custo médio por resultado</p>
            {costChange != null && (
              <p className="text-sm text-muted-foreground">
                {costChange >= 0 ? "↑" : "↓"} {formatPercent(Math.abs(costChange))} vs. período
                anterior
                {costChange < 0 ? " · ganho de eficiência" : ""}
              </p>
            )}
          </div>
          {!hasCost ? (
            <EmptyChart />
          ) : (
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={model.buckets} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(value: number) => formatMoney(value, currency)}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      const point = payload?.[0]?.payload as
                        { costPerResult?: number | null } | undefined;
                      return (
                        <AxisTooltip
                          active={Boolean(active)}
                          label={String(label ?? "")}
                          rows={[
                            {
                              name: "Custo por resultado",
                              value: formatMoney(point?.costPerResult, currency),
                            },
                          ]}
                        />
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="costPerResult"
                    name="Custo por resultado"
                    stroke="var(--info)"
                    strokeWidth={2}
                    connectNulls={false}
                    dot={model.buckets.length <= 31}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Investimento e geração de resultados"
        description="Barras em reais e linha em quantidade de resultados, em eixos separados."
      >
        {!hasMovement ? (
          <EmptyChart />
        ) : (
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={model.buckets} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="money"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  label={{
                    value: "R$",
                    angle: -90,
                    position: "insideLeft",
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                  }}
                />
                <YAxis
                  yAxisId="count"
                  orientation="right"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  label={{
                    value: "Qtd",
                    angle: 90,
                    position: "insideRight",
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                  }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    const point = payload?.[0]?.payload as
                      { spend?: number; results?: number } | undefined;
                    return (
                      <AxisTooltip
                        active={Boolean(active)}
                        label={String(label ?? "")}
                        rows={[
                          { name: "Investimento", value: formatMoney(point?.spend, currency) },
                          { name: "Resultados", value: formatInteger(point?.results) },
                        ]}
                      />
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  yAxisId="money"
                  dataKey="spend"
                  name="Investimento (R$)"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="results"
                  name="Resultados"
                  stroke="var(--info)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <CampaignJourney view={view} campaignId={campaignId} />

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Taxa de cliques (CTR)"
          description="Percentual de impressões que geraram cliques."
        >
          <div className="mt-4">
            <strong className="font-display text-2xl">{formatPercent(model.rates.ctr)}</strong>
            <p className="text-sm text-muted-foreground">CTR médio</p>
            <Delta
              current={model.rates.ctr}
              previous={model.previousRates?.ctr ?? null}
              sense="up-good"
            />
          </div>
          {model.buckets.length === 0 || model.buckets.every((bucket) => bucket.ctr == null) ? (
            <EmptyChart />
          ) : (
            <RateChart
              buckets={model.buckets}
              dataKey="ctr"
              name="CTR"
              format={(value) => formatPercent(value)}
            />
          )}
        </Panel>
        <Panel title="Custo por clique" description="Valor médio investido para gerar cada clique.">
          <div className="mt-4">
            <strong className="font-display text-2xl">
              {formatMoney(model.rates.cpc, currency)}
            </strong>
            <p className="text-sm text-muted-foreground">CPC médio</p>
            <Delta
              current={model.rates.cpc}
              previous={model.previousRates?.cpc ?? null}
              sense="down-good"
            />
          </div>
          {model.buckets.every((bucket) => bucket.cpc == null) ? (
            <EmptyChart />
          ) : (
            <RateChart
              buckets={model.buckets}
              dataKey="cpc"
              name="CPC"
              format={(value) => formatMoney(value, currency)}
            />
          )}
        </Panel>
      </div>

      <Panel
        title="Alcance e impressões"
        description="Alcance conta pessoas. Impressões contam exibições. Uma não é meta de qualidade da outra."
      >
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <strong className="font-display text-2xl">{formatInteger(model.current.reach)}</strong>
            <p className="text-sm text-muted-foreground">Pessoas alcançadas</p>
          </div>
          <div>
            <strong className="font-display text-2xl">
              {formatInteger(model.current.impressions)}
            </strong>
            <p className="text-sm text-muted-foreground">Impressões</p>
          </div>
          <div>
            <strong className="font-display text-2xl">
              {formatDecimal(model.rates.frequency)}
            </strong>
            <p className="text-sm text-muted-foreground">Frequência média</p>
          </div>
        </div>
      </Panel>

      {ranked.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel
            title="Resultados por campanha"
            description="Da campanha com mais resultados para a com menos."
          >
            <RankChart rows={ranked} currency={currency} />
          </Panel>
          <Panel
            title="Custo por resultado por campanha"
            description="O menor custo não define sozinho a melhor campanha. O volume de resultados aparece junto."
          >
            {withCost.length === 0 ? (
              <EmptyChart />
            ) : (
              <ul className="mt-4 space-y-3">
                {[...withCost]
                  .sort((left, right) => (left.costPerResult ?? 0) - (right.costPerResult ?? 0))
                  .map((row) => (
                    <li key={row.id} className="rounded-md border px-3 py-2">
                      <p className="truncate text-sm font-medium" title={row.name}>
                        {row.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatMoney(row.costPerResult, currency)} por resultado ·{" "}
                        {formatInteger(row.results)} resultados
                      </p>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowRight className="size-3.5" />
        Período{" "}
        {view.period.mode === "total"
          ? "Total"
          : `${view.period.since.split("-").reverse().join("/")} – ${view.period.until.split("-").reverse().join("/")}`}
      </p>
    </div>
  );
}

export function CampaignJourney({
  view,
  campaignId = null,
}: {
  view: MetaPerformanceView;
  campaignId?: string | null;
}) {
  const model = useMemo(
    () =>
      view.kpis
        ? buildAnalysis({
            period: view.period,
            campaigns: view.campaigns,
            kpis: view.kpis,
            previous: view.previous,
            previousReady: view.previousReady,
            previousCampaigns: view.previousCampaigns,
            days: view.days,
            campaignId,
          })
        : null,
    [view, campaignId],
  );
  if (!view.kpis || !model) return null;
  const currency = view.currency || "BRL";
  return (
    <Panel
      title="Jornada da campanha"
      description="Visão de desempenho. Alcance, cliques e resultados não formam uma taxa de conversão única."
    >
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(16.5rem,0.7fr)]">
        <JourneyFunnel
          stages={[
            {
              label: "Impressões",
              value: formatInteger(model.current.impressions),
              amount: model.current.impressions,
            },
            {
              label: "Pessoas alcançadas",
              value: formatInteger(model.current.reach),
              amount: model.current.reach,
            },
            {
              label: "Cliques",
              value: formatInteger(model.current.clicks),
              amount: model.current.clicks,
            },
            {
              label: "Resultados",
              value: model.comparable ? formatInteger(model.current.results) : "—",
              amount: model.comparable ? model.current.results : null,
            },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <SmallMetric
            label="CTR"
            value={formatPercent(model.rates.ctr)}
            hint="Percentual de impressões que geraram cliques."
            current={null}
            previous={null}
            sense="neutral"
          />
          <SmallMetric
            label="CPC"
            value={formatMoney(model.rates.cpc, currency)}
            hint="Valor médio investido para gerar cada clique."
            current={null}
            previous={null}
            sense="neutral"
          />
          <SmallMetric
            label="Custo por Aquisição"
            value={formatMoney(model.rates.costPerResult, currency)}
            hint="Investimento médio para cada aquisição."
            current={null}
            previous={null}
            sense="neutral"
          />
        </div>
      </div>
    </Panel>
  );
}

const journeyFills = [
  "var(--primary)",
  "var(--info)",
  "color-mix(in oklch, var(--info) 42%, var(--cyan))",
  "var(--success)",
];

function JourneyFunnel({
  stages,
}: {
  stages: { label: string; value: string; amount: number | null }[];
}) {
  const widths = funnelStageWidths(stages.map((stage) => stage.amount));
  const count = stages.length;
  const chartWidth = 100;
  const chartHeight = 100;
  const stageHeight = count > 0 ? chartHeight / count : chartHeight;
  const center = chartWidth / 2;
  const widest = 94;
  const bands = stages.map((stage, index) => {
    const topRatio = widths[index] ?? 0;
    const bottomRatio = index < count - 1 ? (widths[index + 1] ?? 0) : topRatio;
    const overlap = 0.8;
    const y = index * stageHeight - (index > 0 ? overlap : 0);
    const height = stageHeight + (index > 0 ? overlap : 0) + (index < count - 1 ? overlap : 0);
    return {
      ...stage,
      fill: journeyFills[index] ?? "var(--primary)",
      path: funnelBandPath(center, y, height, topRatio * widest, bottomRatio * widest),
    };
  });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(8.75rem,12rem)] items-stretch gap-3 sm:gap-4">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="none"
        className="h-64 w-full sm:h-72"
        role="img"
        aria-label="Funil proporcional da jornada da campanha"
      >
        {bands.map((band) =>
          band.path ? <path key={band.label} d={band.path} fill={band.fill} /> : null,
        )}
      </svg>
      <ol
        className="grid h-64 sm:h-72"
        style={{ gridTemplateRows: `repeat(${Math.max(count, 1)}, minmax(0, 1fr))` }}
        aria-label="Indicadores do funil"
      >
        {bands.map((band) => (
          <li key={band.label} className="flex min-w-0 items-center gap-2.5">
            <span
              className="h-7 w-1 shrink-0 rounded-full"
              style={{ background: band.fill }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-xs leading-tight text-muted-foreground">{band.label}</p>
              <p className="text-sm font-semibold tabular-nums">{band.value}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function funnelBandPath(
  center: number,
  y: number,
  height: number,
  topWidth: number,
  bottomWidth: number,
) {
  if (topWidth <= 0 && bottomWidth <= 0) return "";
  const bottom = y + height;
  return `M ${center - topWidth / 2} ${y} L ${center + topWidth / 2} ${y} L ${center + bottomWidth / 2} ${bottom} L ${center - bottomWidth / 2} ${bottom} Z`;
}

function SmallMetric({
  label,
  value,
  hint,
  current,
  previous,
  sense,
}: {
  label: string;
  value: string;
  hint: string;
  current: number | null;
  previous: number | null;
  sense: ChangeSense;
}) {
  return (
    <article className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <strong className="mt-1 block text-xl">{value}</strong>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <Delta current={current} previous={previous} sense={sense} />
    </article>
  );
}

function RateChart({
  buckets,
  dataKey,
  name,
  format,
}: {
  buckets: { label: string; ctr: number | null; cpc: number | null }[];
  dataKey: "ctr" | "cpc";
  name: string;
  format: (value: number | null) => string;
}) {
  return (
    <div className="mt-4 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              const point = payload?.[0]?.value;
              return (
                <AxisTooltip
                  active={Boolean(active)}
                  label={String(label ?? "")}
                  rows={[{ name, value: format(typeof point === "number" ? point : null) }]}
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            name={name}
            stroke="var(--primary)"
            strokeWidth={2}
            connectNulls={false}
            dot={buckets.length <= 31}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RankChart({
  rows,
  currency,
}: {
  rows: {
    id: string;
    name: string;
    results: number;
    spend: number;
    costPerResult: number | null;
  }[];
  currency: string;
}) {
  const height = Math.min(420, Math.max(180, rows.length * 46));
  return (
    <div className="mt-4" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tickFormatter={(value: string) =>
              value.length > 22 ? `${value.slice(0, 21)}…` : value
            }
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as
                | { name?: string; results?: number; spend?: number; costPerResult?: number | null }
                | undefined;
              if (!active || !point) return null;
              return (
                <AxisTooltip
                  active
                  label={point.name ?? ""}
                  rows={[
                    { name: "Resultados", value: formatInteger(point.results) },
                    { name: "Investimento", value: formatMoney(point.spend, currency) },
                    {
                      name: "Custo por resultado",
                      value: formatMoney(point.costPerResult, currency),
                    },
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="results"
            name="Resultados"
            fill="var(--primary)"
            radius={[0, 4, 4, 0]}
            barSize={16}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
