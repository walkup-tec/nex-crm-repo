import { useEffect, useState } from "react";
import { BarChart3, BriefcaseBusiness, CheckCheck, MessageSquare, SlidersHorizontal, Star, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chatbotOverviewFn } from "@/lib/chatbot.functions";
import { negotiatedLabel, ratingAverageLabel, type ChatbotOverview } from "@/lib/chatbot-evo";
import { useWorkspace } from "@/lib/chatbot/store";
import { Field, Modal, PageHeading } from "./common";

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
        title={reports ? "Relatórios" : "Visão Geral"}
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
          <div className="chart-empty">{overview.received ? `${overview.received} contatos receberam atendimento` : "Ainda não há dados para este período"}</div>
        </section>
        <section className="chart-panel">
          <h2>Distribuição por etapa</h2>
          <div className="mt-7 space-y-5">
            {data.stages.map((stage) => (
              <div className="flex justify-between text-xs" key={stage}>
                <span className="text-muted-foreground">{stage}</span>
                <strong>{data.opportunities.filter((item) => item.stage === stage).length}</strong>
              </div>
            ))}
          </div>
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
