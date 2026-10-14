import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { listChatbotClientsFn } from "@/lib/chatbot.functions";
import { clientFilterOptions, clientPhoneLabel, filterChatbotClients, negotiatedLabel, type ChatbotClientRow, type ClientListFilters } from "@/lib/chatbot-evo";

const emptyFilters: ClientListFilters = { search: "", name: "", tag: "", attendant: "", stage: "", product: "" };

const selectors = [
  { key: "name", label: "Cliente" },
  { key: "tag", label: "Etiquetas" },
  { key: "attendant", label: "Atendente" },
  { key: "stage", label: "Kanban" },
  { key: "product", label: "Produto" },
] as const;

export function LiveClients() {
  const [clients, setClients] = useState<ChatbotClientRow[]>([]);
  const [filters, setFilters] = useState<ClientListFilters>(emptyFilters);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void listChatbotClientsFn().then((result) => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setClients(result.data);
    });
  }, []);

  const options = clientFilterOptions(clients);
  const visible = filterChatbotClients(clients, filters);
  const filtering = selectors.some((item) => filters[item.key]) || filters.search.trim().length > 0;

  function setFilter(key: keyof ClientListFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="page">
      {message ? <p className="info-note mb-5">{message}</p> : null}
      <div className="empty-table">
        <div className="table-toolbar client-toolbar">
          <div className="client-filters">
            <input className="client-search" placeholder="Buscar clientes" value={filters.search} onChange={(event) => setFilter("search", event.target.value)} aria-label="Buscar clientes" />
            {selectors.map((item) => (
              <select key={item.key} className="client-filter" aria-label={item.label} value={filters[item.key]} onChange={(event) => setFilter(item.key, event.target.value)}>
                <option value="">{item.label}</option>
                {options[item.key].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ))}
            <Button type="button" variant="outline" size="sm" className="client-clear" onClick={() => setFilters(emptyFilters)}>
              Limpar Filtros
            </Button>
          </div>
          <span className="status-pill">{visible.length} registros</span>
        </div>
        {visible.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>WhatsApp</th>
                  <th>Valor negociado</th>
                  <th>Etiquetas</th>
                  <th>Atendente</th>
                  <th>Kanban</th>
                  <th>Produto</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <strong>{client.name}</strong>
                    </td>
                    <td>{clientPhoneLabel(client.phone) || client.phone}</td>
                    <td>{negotiatedLabel(client.negotiatedCents) || "—"}</td>
                    <td>{client.tags.join(", ") || "—"}</td>
                    <td>{client.attendant || "—"}</td>
                    <td>{client.stage || "—"}</td>
                    <td>{client.products.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h2>{filtering ? "Nenhum resultado encontrado" : "Nenhum cliente cadastrado"}</h2>
            <p>O cadastro é feito no contato, na caixa de entrada. Cada atendente vê apenas os clientes que cadastrou.</p>
          </div>
        )}
      </div>
    </main>
  );
}
