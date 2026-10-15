import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callChatbotContactFn, listChatbotClientsFn } from "@/lib/chatbot.functions";
import { clientFilterOptions, clientPhoneLabel, filterChatbotClients, negotiatedLabel, type ChatbotClientRow, type ClientListFilters } from "@/lib/chatbot-evo";

const emptyFilters: ClientListFilters = { search: "", name: "", tag: "", attendant: "", stage: "", product: "" };

const selectors = [
  { key: "name", label: "Cliente" },
  { key: "tag", label: "Etiquetas" },
  { key: "attendant", label: "Atendente" },
  { key: "stage", label: "Kanban" },
  { key: "product", label: "Produto" },
] as const;

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="9" fill="#25D366" />
      <path
        fill="#fff"
        d="M12.7 10.2c-.2-.1-1.1-.55-1.27-.61-.17-.06-.3-.1-.42.1-.12.19-.48.61-.59.74-.11.12-.22.14-.41.05-.19-.1-.79-.29-1.5-.93-.56-.5-.93-1.11-1.04-1.3-.11-.19-.01-.29.08-.38.08-.08.19-.22.28-.33.09-.11.12-.19.19-.32.06-.12.03-.24-.02-.33-.05-.1-.42-1.02-.58-1.4-.15-.36-.31-.31-.42-.32h-.32c-.13 0-.33.05-.5.24-.17.19-.66.64-.66 1.57s.68 1.82.77 1.95c.1.12 1.33 2.03 3.22 2.85.45.19.8.31 1.07.4.45.14.86.12 1.18.07.36-.05 1.1-.45 1.26-.89.15-.44.15-.81.11-.89-.05-.08-.17-.12-.36-.21z"
      />
    </svg>
  );
}

export function LiveClients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ChatbotClientRow[]>([]);
  const [filters, setFilters] = useState<ClientListFilters>(emptyFilters);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<ChatbotClientRow | null>(null);
  const [calling, setCalling] = useState(false);
  const [failure, setFailure] = useState("");

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

  async function call(contactId: string) {
    setCalling(true);
    const result = await callChatbotContactFn({ data: { contactId } });
    setCalling(false);
    if (!result.ok) {
      setFailure(result.message);
      return;
    }
    sessionStorage.setItem("nex-kanban-conversation", result.data.conversationId);
    void navigate({ to: "/chatbot" });
  }

  const detailFields = selected
    ? [
        ["WhatsApp", clientPhoneLabel(selected.phone) || selected.phone || "—"],
        ["Valor negociado", negotiatedLabel(selected.negotiatedCents) || "—"],
        ["Etiquetas", selected.tags.join(", ") || "—"],
        ["Atendente", selected.attendant || "—"],
        ["Kanban", selected.stage || "—"],
        ["Produto", selected.products.join(", ") || "—"],
      ]
    : [];

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
                      <div className="client-name">
                        <button type="button" className="client-view" aria-label={`Ver detalhes de ${client.name}`} onClick={() => setSelected(client)}>
                          <Eye />
                        </button>
                        <strong>{client.name}</strong>
                      </div>
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
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="chatbot-app client-dialog">
          <DialogHeader>
            <DialogTitle>{selected?.name || "Cliente"}</DialogTitle>
            <DialogDescription>Detalhes do cadastro deste cliente.</DialogDescription>
          </DialogHeader>
          <dl className="client-details">
            {detailFields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <Button type="button" className="client-call" disabled={!selected || calling} onClick={() => selected && void call(selected.id)}>
            <WhatsAppIcon />
            {calling ? "Abrindo" : "Chamar"}
          </Button>
        </DialogContent>
      </Dialog>
      <AlertDialog open={failure !== ""} onOpenChange={(open) => !open && setFailure("")}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não foi possível concluir</AlertDialogTitle>
            <AlertDialogDescription>{failure}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Entendi</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
