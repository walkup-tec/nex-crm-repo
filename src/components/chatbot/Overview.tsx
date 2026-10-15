import { useEffect, useMemo, useState } from "react";
import { BarChart3, BriefcaseBusiness, CheckCheck, MessageSquare, SlidersHorizontal, Star, TrendingUp, Users } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { chatbotOverviewFn } from "@/lib/chatbot.functions";
import { attendanceSeries, negotiatedLabel, ratingAverageLabel, type ChatbotOverview } from "@/lib/chatbot-evo";
import { JourneyFunnel } from "@/components/nex/StageFunnel";
import { useWorkspace } from "@/lib/chatbot/store";
import { Field, Modal, PageHeading } from "./common";

const stagePalette = ["var(--primary)", "var(--info)", "var(--warning)", "oklch(0.72 0.16 330)", "var(--success)", "var(--destructive)"];

function stageFill(name: string, index: number) {
  const key = name.trim().toLocaleLowerCase("pt-BR");
  if (key === "sucesso") return "var(--success)";
  if (key === "perdido") return "var(--destructive)";
  return stagePalette[index % stagePalette.length];
}

const emptyOverview: ChatbotOverview = {
  received: 0,
  attending: 0,
  finished: 0,
  openDeals: 0,
  negotiatingCents: 0,
  wonCents: 0,
  clients: 0,
  ratingAverage: null,
  ratingCount: 0,
  stages: [],
  days: [],
};

export function Overview({ reports = false }: { reports?: boolean }) {
  const { data } = useWorkspace();
  const [period, setPeriod] = useState("Últimos 30 dias");
  const [filters, setFilters] = useState(false);
  const [overview, setOverview] = useState<ChatbotOverview>(emptyOverview);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void chatbotOverviewFn().then((result) => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setOverview(result.data);
    });
  }, []);

  const series = useMemo(() => attendanceSeries(overview.days, period), [overview.days, period]);

  const metrics = [
    ["Atendimentos recebidos", String(overview.received), MessageSquare],
    ["Em atendimento", String(overview.attending), Users],
    ["Encerrados", String(overview.finished), CheckCheck],
    ["Oportunidades abertas", String(overview.openDeals), BriefcaseBusiness],
    ["Valor em negociação", negotiatedLabel(overview.negotiatingCents), TrendingUp],
    ["Valor ganho", negotiatedLabel(overview.wonCents), TrendingUp],
    ["Clientes cadastrados", String(overview.clients), Users, ""],
    ["Nota média", ratingAverageLabel(overview.ratingAverage), Star, overview.ratingCount ? `${overview.ratingCount} ${overview.ratingCount === 1 ? "avaliação" : "avaliações"}` : "Sem avaliações"],
  ] as const;

  return (
    <main className="page">
      <PageHeading
        title={reports ? "Relatórios" : "Dashboard Chatbot"}
        description={reports ? "Uma visão clara dos resultados da sua operação." : "Seu atendimento e sua operação comercial, em perspectiva."}
      >
        <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Período">
          <option>Hoje</option>
          <option>Últimos 7 dias</option>
          <option>Últimos 30 dias</option>
          <option>Este mês</option>
        </select>
        <Button variant="outline" onClick={() => setFilters(true)}>
          <SlidersHorizontal />
          Filtros
        </Button>
      </PageHeading>
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
      <div className="chart-grid">
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
        <section className="chart-panel">
          <h2>Distribuição por etapa</h2>
          {overview.stages.length ? (
            <div className="mt-5">
              <JourneyFunnel
                compact
                floor={0.2}
                label="Funil das etapas do atendimento"
                fills={overview.stages.map((stage, index) => stageFill(stage.name, index))}
                stages={overview.stages.map((stage) => ({
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
        {data.agents.length ? (
          <table className="mt-5">
            <thead>
              <tr>
                <th>Atendente</th>
                <th>Equipe</th>
                <th>Atendimentos</th>
                <th>Encerrados</th>
              </tr>
            </thead>
            <tbody>
              {data.agents.map((agent) => (
                <tr key={agent.id}>
                  <td>{agent.name}</td>
                  <td>{agent.team}</td>
                  <td>{data.conversations.filter((item) => item.assigneeId === agent.id).length}</td>
                  <td>{data.conversations.filter((item) => item.assigneeId === agent.id && item.status === "closed").length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <BarChart3 />
            <p>Nenhum resultado disponível.</p>
          </div>
        )}
      </section>
      <Modal title="Filtros dos indicadores" open={filters} onClose={() => setFilters(false)}>
        <div className="modal-form">
          <Field label="Número de WhatsApp">
            <select>
              <option>Todos os números</option>
              {data.connections.map((item) => (
                <option key={item.id}>{item.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Atendente">
            <select>
              <option>Todos os atendentes</option>
              {data.agents.map((item) => (
                <option key={item.id}>{item.name}</option>
              ))}
            </select>
          </Field>
          <Button onClick={() => setFilters(false)}>Aplicar</Button>
        </div>
      </Modal>
    </main>
  );
}
